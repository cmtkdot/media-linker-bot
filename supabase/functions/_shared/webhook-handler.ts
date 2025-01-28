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
    // Generate a unique correlation ID for this message
    const messageCorrelationId = crypto.randomUUID();
    
    console.log('Processing webhook update:', {
      update_id: update.update_id,
      message_id: message.message_id,
      chat_id: message.chat.id,
      media_group_id: message.media_group_id,
      has_caption: !!message.caption,
      message_type: determineMessageType(message)
    });

    // Check if message already exists
    const { data: existingMessage } = await supabase
      .from('messages')
      .select('id, is_original_caption, analyzed_content, media_group_id, original_message_id')
      .eq('message_id', message.message_id)
      .eq('chat_id', message.chat.id)
      .maybeSingle();

    if (existingMessage) {
      console.log('Message already exists:', {
        message_id: message.message_id,
        existing_id: existingMessage.id
      });
      return {
        success: true,
        message: 'Message already exists',
        messageId: existingMessage.id
      };
    }

    const chatId = message.chat.id.toString();
    const messageUrl = `https://t.me/c/${chatId.substring(4)}/${message.message_id}`;
    const messageType = determineMessageType(message);

    let messageData: any = {
      message_id: message.message_id,
      chat_id: message.chat.id,
      sender_info: message.from || message.sender_chat || {},
      message_type: messageType,
      telegram_data: message,
      message_url: messageUrl,
      correlation_id: messageCorrelationId,
      caption: message.caption,
      text: message.text,
      media_group_id: message.media_group_id,
      status: 'pending'
    };

    // Handle media group and caption analysis
    if (message.media_group_id) {
      console.log('Processing media group message:', {
        media_group_id: message.media_group_id,
        message_type: messageType,
        has_caption: !!message.caption
      });

      // Get existing messages in the group
      const { data: groupMessages } = await supabase
        .from('messages')
        .select('id, is_original_caption, analyzed_content, caption, original_message_id')
        .eq('media_group_id', message.media_group_id)
        .order('created_at', { ascending: true });

      const existingCaptionHolder = groupMessages?.find(m => m.is_original_caption);

      if (message.caption) {
        if (!existingCaptionHolder) {
          // This is the first message with a caption in the group
          messageData.is_original_caption = true;
          messageData.original_message_id = null;
          messageData.analyzed_content = await analyzeCaptionWithAI(message.caption);

          // Update existing group messages
          if (groupMessages?.length > 0) {
            await Promise.all(groupMessages.map(async (groupMsg) => {
              await supabase
                .from('messages')
                .update({
                  analyzed_content: messageData.analyzed_content,
                  caption: message.caption,
                  is_original_caption: false,
                  original_message_id: null
                })
                .eq('id', groupMsg.id);
            }));
          }
        } else {
          // Another message already holds the caption
          messageData.is_original_caption = false;
          messageData.original_message_id = existingCaptionHolder.id;
          messageData.analyzed_content = existingCaptionHolder.analyzed_content;
        }
      } else if (existingCaptionHolder) {
        // No caption but group has a caption holder
        messageData.is_original_caption = false;
        messageData.original_message_id = existingCaptionHolder.id;
        messageData.analyzed_content = existingCaptionHolder.analyzed_content;
      }
    } else if (message.caption) {
      // Single media message with caption
      messageData.is_original_caption = true;
      messageData.original_message_id = null;
      messageData.analyzed_content = await analyzeCaptionWithAI(message.caption);
    }

    // Create simplified message_media_data structure
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
      original_message_id: messageData.original_message_id,
      message_type: messageType
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
        message_type: messageType
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
      correlationId: messageCorrelationId
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