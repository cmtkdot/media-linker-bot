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

    // Handle new message creation
    let messageData;
    
    if (messageType === 'text') {
      messageData = await processTextMessage(message, messageUrl, messageCorrelationId);
    } else {
      // Handle media messages (photos, videos, etc.)
      let isOriginalCaption = false;
      let originalMessageId = null;
      let analyzedContent = null;

      if (message.media_group_id) {
        const { data: groupMessages } = await supabase
          .from('messages')
          .select('id, is_original_caption, analyzed_content, caption')
          .eq('media_group_id', message.media_group_id)
          .order('created_at', { ascending: true });

        if (message.caption) {
          const existingCaptionHolder = groupMessages?.find(m => m.is_original_caption);
          
          if (!existingCaptionHolder) {
            isOriginalCaption = true;
            analyzedContent = await analyzeCaptionWithAI(message.caption);
            
            if (groupMessages?.length > 0) {
              await Promise.all(groupMessages.map(async (groupMsg: any) => {
                await supabase
                  .from('messages')
                  .update({
                    analyzed_content: analyzedContent,
                    caption: message.caption
                  })
                  .eq('id', groupMsg.id);
              }));
            }
          } else {
            originalMessageId = existingCaptionHolder.id;
            analyzedContent = existingCaptionHolder.analyzed_content;
          }
        } else if (groupMessages?.length > 0) {
          const captionHolder = groupMessages.find(m => m.is_original_caption);
          if (captionHolder) {
            originalMessageId = captionHolder.id;
            analyzedContent = captionHolder.analyzed_content;
          }
        }
      } else if (message.caption) {
        isOriginalCaption = true;
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

    // Create message_media_data structure
    messageData.message_media_data = await createMessageMediaData(messageData);

    console.log('Inserting message:', {
      message_id: messageData.message_id,
      chat_id: messageData.chat_id,
      correlation_id: messageCorrelationId,
      is_original_caption: messageData.is_original_caption
    });

    // Insert message record
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

    // Only queue photo and video messages for processing
    if (messageType === 'photo' || messageType === 'video') {
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

      if (queueError) {
        console.error('Error queueing message:', queueError);
        throw queueError;
      }
    }

    console.log('Successfully processed message:', {
      message_id: messageRecord.id,
      correlation_id: messageCorrelationId,
      is_original_caption: messageData.is_original_caption,
      message_type: messageType
    });

    return {
      success: true,
      message: 'Update processed successfully',
      messageId: messageRecord.id,
      correlationId: messageCorrelationId,
      isOriginalCaption: messageData.is_original_caption
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