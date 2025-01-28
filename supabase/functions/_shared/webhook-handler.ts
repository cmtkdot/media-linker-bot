import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { analyzeWebhookMessage } from './webhook-message-analyzer.ts';
import { buildWebhookMessageData } from './webhook-message-builder.ts';
import { queueWebhookMessage } from './webhook-queue-manager.ts';

function determineMessageType(message: any): string {
  if (message.photo && message.photo.length > 0) return 'photo';
  if (message.video) return 'video';
  if (message.document) return 'document';
  if (message.animation) return 'animation';
  return 'text';
}

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
      message_type: determineMessageType(message)
    });

    // Generate message URL
    const chatId = message.chat.id.toString();
    const messageUrl = `https://t.me/c/${chatId.substring(4)}/${message.message_id}`;
    
    // Analyze message content
    const messageType = determineMessageType(message);
    const analyzedContent = await analyzeWebhookMessage(message);
    
    // Build message data structure
    const messageData = buildWebhookMessageData(message, messageUrl, analyzedContent);

    console.log('Creating message record with data:', {
      message_id: message.message_id,
      chat_id: message.chat.id,
      message_type: messageType,
      media_group_id: message.media_group_id,
      correlation_id: correlationId,
      has_analyzed_content: !!analyzedContent?.analyzed_content
    });

    // Create message record
    const { data: messageRecord, error: messageError } = await supabase
      .from('messages')
      .insert({
        message_id: message.message_id,
        chat_id: message.chat.id,
        sender_info: message.from || message.sender_chat || {},
        message_type: messageType,
        telegram_data: message,
        message_url: messageUrl,
        correlation_id: correlationId,
        caption: message.caption,
        text: message.text,
        media_group_id: message.media_group_id,
        media_group_size: message.media_group_id ? 1 : null,
        status: 'pending',
        is_original_caption: analyzedContent.is_original_caption,
        original_message_id: analyzedContent.original_message_id,
        analyzed_content: analyzedContent.analyzed_content,
        message_media_data: messageData,
        last_group_message_at: new Date().toISOString()
      })
      .select()
      .single();

    if (messageError) {
      console.error('Error creating message record:', messageError);
      throw messageError;
    }

    console.log('Message record created:', {
      record_id: messageRecord.id,
      message_id: messageRecord.message_id,
      chat_id: messageRecord.chat_id,
      message_type: messageRecord.message_type
    });

    // Check if we should queue for processing
    if (messageType === 'photo' || messageType === 'video') {
      console.log('Queueing message for processing:', {
        message_id: message.message_id,
        media_group_id: message.media_group_id,
        message_type: messageType
      });

      await queueWebhookMessage(supabase, messageData, correlationId, messageType);
    }

    return {
      success: true,
      message: 'Update processed successfully',
      messageId: messageRecord.id,
      data: {
        telegram_data: messageRecord.telegram_data,
        message_media_data: messageData,
        status: messageRecord.status
      }
    };

  } catch (error) {
    console.error('Error in webhook handler:', error);
    throw error;
  }
}