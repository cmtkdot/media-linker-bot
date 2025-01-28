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
      // Check for existing messages in the group
      const { data: existingMessages } = await supabase
        .from('messages')
        .select('id, is_original_caption, analyzed_content, caption')
        .eq('media_group_id', message.media_group_id)
        .order('created_at', { ascending: true });

      // Find existing caption holder if any
      const existingCaptionHolder = existingMessages?.find(m => m.is_original_caption);

      if (message.caption) {
        if (!existingCaptionHolder) {
          // This is the first message with a caption in the group
          console.log('Setting as original caption holder:', message.message_id);
          isOriginalCaption = true;
          analyzedContent = await analyzeCaptionWithAI(message.caption);
        } else {
          // Use existing caption holder's content
          console.log('Using existing caption holder:', existingCaptionHolder.id);
          originalMessageId = existingCaptionHolder.id;
          analyzedContent = existingCaptionHolder.analyzed_content;
        }
      } else if (existingCaptionHolder) {
        // For non-caption messages in group, reference the caption holder
        console.log('Referencing existing caption holder:', existingCaptionHolder.id);
        originalMessageId = existingCaptionHolder.id;
        analyzedContent = existingCaptionHolder.analyzed_content;
      }
    } else if (message.caption) {
      // Single message with caption is always original
      console.log('Single message with caption:', message.message_id);
      isOriginalCaption = true;
      analyzedContent = await analyzeCaptionWithAI(message.caption);
    }

    // Create message media data structure with simplified analysis section
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
        original_message_id: originalMessageId,
        retry_count: 0
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

    // Insert/update message record
    const { data: messageRecord, error: messageError } = await withDatabaseRetry(async () => {
      return await supabase
        .from('messages')
        .upsert(messageData)
        .select()
        .single();
    });

    if (messageError) throw messageError;

    // Queue for processing
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
      });

    if (queueError) throw queueError;

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