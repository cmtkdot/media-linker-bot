import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { analyzeCaptionWithAI } from './caption-analyzer.ts';
import { withDatabaseRetry } from './database-retry.ts';
import { processTextMessage, createMessageMediaData } from './message-processor.ts';

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
    // Generate a new correlation ID for each unique message
    const messageCorrelationId = crypto.randomUUID();
    
    console.log('Processing webhook update:', {
      update_id: update.update_id,
      message_id: message.message_id,
      chat_id: message.chat.id,
      media_group_id: message.media_group_id,
      has_caption: !!message.caption,
      has_text: !!message.text,
      message_type: determineMessageType(message),
      correlation_id: messageCorrelationId
    });

    // Check if message already exists
    const { data: existingMessage } = await supabase
      .from('messages')
      .select('id, is_original_caption, analyzed_content, media_group_id')
      .eq('message_id', message.message_id)
      .eq('chat_id', message.chat.id)
      .maybeSingle();

    const chatId = message.chat.id.toString();
    const messageUrl = `https://t.me/c/${chatId.substring(4)}/${message.message_id}`;
    const messageType = determineMessageType(message);

    // If message exists, return early
    if (existingMessage) {
      console.log('Message already exists:', {
        message_id: message.message_id,
        existing_id: existingMessage.id
      });
      return {
        success: true,
        message: 'Message already exists',
        messageId: existingMessage.id,
        correlationId: messageCorrelationId
      };
    }

    let messageData;
    
    if (messageType === 'text') {
      messageData = await processTextMessage(message, messageUrl, messageCorrelationId);
    } else {
      let originalMessageId = null;
      let analyzedContent = null;
      let isOriginalCaption = false;

      // Check for media group and handle caption syncing
      if (message.media_group_id) {
        console.log('Processing media group message:', {
          media_group_id: message.media_group_id,
          message_type: messageType,
          has_caption: !!message.caption
        });

        // Get all existing messages in the group
        const { data: groupMessages } = await supabase
          .from('messages')
          .select('id, is_original_caption, analyzed_content, caption, original_message_id')
          .eq('media_group_id', message.media_group_id)
          .order('created_at', { ascending: true });

        const existingCaptionHolder = groupMessages?.find(m => m.is_original_caption);

        if (message.caption) {
          if (!existingCaptionHolder) {
            isOriginalCaption = true;
            originalMessageId = null;
            analyzedContent = await analyzeCaptionWithAI(message.caption);

            // Update all existing messages in the group
            if (groupMessages?.length > 0) {
              await Promise.all(groupMessages.map(async (groupMsg) => {
                await supabase
                  .from('messages')
                  .update({
                    analyzed_content: analyzedContent,
                    caption: message.caption,
                    is_original_caption: false,
                    original_message_id: null
                  })
                  .eq('id', groupMsg.id);
              }));
            }
          } else {
            isOriginalCaption = false;
            originalMessageId = existingCaptionHolder.id;
            analyzedContent = existingCaptionHolder.analyzed_content;
          }
        } else {
          if (existingCaptionHolder) {
            isOriginalCaption = false;
            originalMessageId = existingCaptionHolder.id;
            analyzedContent = existingCaptionHolder.analyzed_content;
          } else {
            isOriginalCaption = false;
            originalMessageId = null;
          }
        }
      } else if (message.caption) {
        isOriginalCaption = true;
        originalMessageId = null;
        analyzedContent = await analyzeCaptionWithAI(message.caption);
      }

      messageData = {
        message_id: message.message_id,
        chat_id: message.chat.id,
        sender_info: message.from || message.sender_chat || {},
        message_type: messageType,
        telegram_data: message,
        media_group_id: message.media_group_id,
        message_url: messageUrl,
        correlation_id: messageCorrelationId,
        is_original_caption: isOriginalCaption,
        original_message_id: originalMessageId,
        analyzed_content: analyzedContent,
        caption: message.caption,
        text: message.text,
        status: messageType === 'text' ? 'processed' : 'pending'
      };
    }

    // Create message_media_data structure with simplified analysis
    messageData.message_media_data = {
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
        analyzed_content: messageData.analyzed_content
      },
      meta: {
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: messageData.status,
        error: null,
        is_original_caption: messageData.is_original_caption,
        original_message_id: messageData.original_message_id,
        processed_at: null,
        last_retry_at: null,
        retry_count: 0
      }
    };

    console.log('Inserting message:', {
      message_id: messageData.message_id,
      chat_id: messageData.chat_id,
      correlation_id: messageCorrelationId,
      is_original_caption: messageData.is_original_caption,
      original_message_id: messageData.original_message_id
    });

    // Insert message record
    const { data: messageRecord, error: messageError } = await withDatabaseRetry(async () => {
      return await supabase
        .from('messages')
        .insert(messageData)
        .select()
        .single();
    });

    if (messageError) throw messageError;

    // Queue media messages for processing
    if (messageType === 'photo' || messageType === 'video') {
      console.log('Queueing media message for processing:', {
        message_id: message.message_id,
        media_group_id: message.media_group_id,
        message_type: messageType,
        is_original_caption: messageData.is_original_caption,
        original_message_id: messageData.original_message_id
      });

      const { error: queueError } = await supabase
        .from('unified_processing_queue')
        .insert({
          queue_type: message.media_group_id ? 'media_group' : 'media',
          data: messageData.message_media_data,
          status: 'pending',
          correlation_id: messageCorrelationId,
          chat_id: message.chat.id,
          message_id: message.message_id,
          message_media_data: messageData.message_media_data
        });

      if (queueError) throw queueError;
    }

    return {
      success: true,
      message: 'Update processed successfully',
      messageId: messageRecord.id,
      correlationId: messageCorrelationId,
      isOriginalCaption: messageData.is_original_caption,
      originalMessageId: messageData.original_message_id
    };

  } catch (error) {
    console.error('Error in webhook handler:', error);
    throw error;
  }
}

function determineMessageType(message: any): string {
  if (message.text && !message.photo && !message.video && !message.document && !message.animation) return 'text';
  if (message.photo && message.photo.length > 0) return 'photo';
  if (message.video) return 'video';
  if (message.document) return 'document';
  if (message.animation) return 'animation';
  return 'unknown';
}