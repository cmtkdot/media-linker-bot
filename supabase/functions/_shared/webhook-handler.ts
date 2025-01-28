import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { analyzeCaptionWithAI } from './caption-analyzer.ts';
import { withDatabaseRetry } from './database-retry.ts';

export async function handleWebhookUpdate(
  update: any, 
  supabase: any,
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

    // Check if message already exists
    const { data: existingMessage } = await supabase
      .from('messages')
      .select('id, is_original_caption, analyzed_content')
      .eq('message_id', message.message_id)
      .eq('chat_id', message.chat.id)
      .maybeSingle();

    if (existingMessage) {
      console.log('Message already exists:', existingMessage);
      return {
        success: true,
        message: 'Message already processed',
        messageId: existingMessage.id,
        correlationId
      };
    }

    const chatId = message.chat.id.toString();
    const messageUrl = `https://t.me/c/${chatId.substring(4)}/${message.message_id}`;

    let isOriginalCaption = false;
    let originalMessageId = null;
    let analyzedContent = null;

    // Handle media group caption logic
    if (message.media_group_id) {
      console.log('Processing media group message:', message.media_group_id);
      
      const { data: groupMessages } = await supabase
        .from('messages')
        .select('id, is_original_caption, analyzed_content, caption')
        .eq('media_group_id', message.media_group_id)
        .order('created_at', { ascending: true });

      if (message.caption) {
        const captionHolder = groupMessages?.find(m => m.is_original_caption);
        if (!captionHolder) {
          console.log('This is the first caption in the group');
          isOriginalCaption = true;
          analyzedContent = await analyzeCaptionWithAI(message.caption);
        } else {
          console.log('Using existing caption holder:', captionHolder.id);
          originalMessageId = captionHolder.id;
          analyzedContent = captionHolder.analyzed_content;
        }
      } else if (groupMessages?.length > 0) {
        const captionHolder = groupMessages.find(m => m.is_original_caption);
        if (captionHolder) {
          originalMessageId = captionHolder.id;
          analyzedContent = captionHolder.analyzed_content;
        }
      }
    } else if (message.caption) {
      console.log('Processing single message with caption');
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
        chat_info: message.chat
      },
      analysis: {
        analyzed_content: analyzedContent
      },
      meta: {
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'pending',
        error: null,
        is_original_caption: isOriginalCaption,
        original_message_id: originalMessageId,
        correlation_id: correlationId
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
      analyzed_content: analyzedContent,
      message_media_data: messageMediaData,
      status: 'pending',
      caption: message.caption
    };

    console.log('Inserting message:', {
      message_id: messageData.message_id,
      chat_id: messageData.chat_id,
      media_group_id: messageData.media_group_id,
      is_original_caption: messageData.is_original_caption
    });

    // Insert message record with conflict handling
    const { data: messageRecord, error: messageError } = await withDatabaseRetry(async () => {
      return await supabase
        .from('messages')
        .insert(messageData)
        .select()
        .single();
    });

    if (messageError) {
      console.error('Error creating message:', messageError);
      throw messageError;
    }

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

    if (queueError) {
      console.error('Error queueing message:', queueError);
      throw queueError;
    }

    console.log('Successfully processed message:', {
      message_id: messageRecord.id,
      correlation_id: correlationId,
      is_original_caption: isOriginalCaption
    });

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