import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { analyzeCaptionWithAI } from './caption-analyzer.ts';
import { withDatabaseRetry } from './database-retry.ts';

export async function handleWebhookUpdate(
  update: any, 
  supabase: any, 
  botToken: string,
  correlationId: string
) {
  const message = update.message || update.channel_post;
  if (!message) {
    console.log('No message in update');
    return { message: 'No message in update' };
  }

  try {
    console.log('Processing webhook update:', {
      update_id: update.update_id,
      message_id: message.message_id,
      chat_id: message.chat.id,
      media_group_id: message.media_group_id,
      has_caption: !!message.caption,
      correlation_id: correlationId
    });

    const chatId = message.chat.id.toString();
    const messageUrl = `https://t.me/c/${chatId.substring(4)}/${message.message_id}`;

    let isOriginalCaption = false;
    let originalMessageId = null;
    let analyzedContent = null;

    // Handle media group caption logic
    if (message.media_group_id) {
      // First, check if we already have a message with original caption in this group
      const { data: existingOriginal } = await supabase
        .from('messages')
        .select('id, analyzed_content')
        .eq('media_group_id', message.media_group_id)
        .eq('is_original_caption', true)
        .single();

      if (message.caption) {
        if (!existingOriginal) {
          // This is the first message with a caption in the group
          console.log('Setting as original caption holder:', message.message_id);
          isOriginalCaption = true;
          analyzedContent = await analyzeCaptionWithAI(message.caption);
        } else {
          // Use existing caption holder's content
          console.log('Using existing caption holder:', existingOriginal.id);
          originalMessageId = existingOriginal.id;
          analyzedContent = existingOriginal.analyzed_content;
        }
      } else if (existingOriginal) {
        // For non-caption messages in group, reference the caption holder
        console.log('Referencing existing caption holder:', existingOriginal.id);
        originalMessageId = existingOriginal.id;
        analyzedContent = existingOriginal.analyzed_content;
      }
    } else if (message.caption) {
      // Single message with caption is always original
      console.log('Single message with caption:', message.message_id);
      isOriginalCaption = true;
      analyzedContent = await analyzeCaptionWithAI(message.caption);
    }

    // Create message media data structure
    const messageMediaData = {
      message: {
        url: messageUrl,
        media_group_id: message.media_group_id,
        caption: message.caption,
        message_id: message.message_id,
        chat_id: message.chat.id,
        date: message.date
      },
      sender: {
        sender_info: message.from || message.sender_chat || {},
        chat_info: message.chat || {}
      },
      analysis: {
        analyzed_content: analyzedContent
      },
      meta: {
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'pending',
        error: null,
        correlation_id: correlationId,
        is_original_caption: isOriginalCaption,
        original_message_id: originalMessageId
      }
    };

    // Create message record
    const messageData = {
      message_id: message.message_id,
      chat_id: message.chat.id,
      sender_info: message.from || message.sender_chat || {},
      message_type: determineMessageType(message),
      telegram_data: message,
      media_group_id: message.media_group_id,
      message_url: messageUrl,
      correlation_id: correlationId,
      is_original_caption: isOriginalCaption,
      original_message_id: originalMessageId,
      message_media_data: messageMediaData,
      analyzed_content: analyzedContent,
      status: 'pending',
      caption: message.caption
    };

    // If this is a non-original message in a media group, wait briefly to ensure original exists
    if (message.media_group_id && !isOriginalCaption && originalMessageId) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Insert/update message record
    const { data: messageRecord, error: messageError } = await withDatabaseRetry(async () => {
      return await supabase
        .from('messages')
        .upsert(messageData)
        .select()
        .single();
    });

    if (messageError) throw messageError;

    // Queue for processing only if not already queued
    const { error: queueError } = await supabase
      .from('unified_processing_queue')
      .insert({
        queue_type: message.media_group_id ? 'media_group' : 'media',
        data: messageMediaData,
        status: 'pending',
        correlation_id: correlationId,
        chat_id: message.chat.id,
        message_id: message.message_id,
        message_media_data: messageMediaData
      })
      .onConflict(['correlation_id', 'message_id', 'chat_id'])
      .ignore();

    if (queueError) {
      console.error('Error queueing message:', queueError);
    }

    return {
      success: true,
      message: 'Update processed successfully',
      messageId: messageRecord.id,
      correlationId,
      isOriginalCaption
    };

  } catch (error) {
    console.error('Error in webhook handler:', error);
    throw error;
  }
}

function determineMessageType(message: any): string {
  if (message.photo && message.photo.length > 0) return 'photo';
  if (message.video) return 'video';
  if (message.document) return 'document';
  if (message.animation) return 'animation';
  return 'unknown';
}