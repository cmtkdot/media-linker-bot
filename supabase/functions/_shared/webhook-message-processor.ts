import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { WebhookUpdate, WebhookResponse } from './webhook-types.ts';
import { buildWebhookMessageData } from './webhook-message-builder.ts';
import { analyzeWebhookMessage } from './webhook-message-analyzer.ts';

export async function processWebhookMessage(
  update: WebhookUpdate,
  supabase: any,
  correlationId: string
): Promise<WebhookResponse> {
  const message = update.message || update.channel_post;
  
  if (!message) {
    console.log('No message in update');
    return { success: false, message: 'No message in update' };
  }

  try {
    console.log('Processing webhook message:', {
      update_id: update.update_id,
      message_id: message.message_id,
      chat_id: message.chat.id,
      media_group_id: message.media_group_id,
      has_caption: !!message.caption
    });

    // Generate message URL
    const chatId = message.chat.id.toString();
    const messageUrl = `https://t.me/c/${chatId.substring(4)}/${message.message_id}`;

    // Analyze message content
    const analyzedContent = await analyzeWebhookMessage(message);
    
    // Build message data structure
    const messageData = buildWebhookMessageData(message, messageUrl, analyzedContent);

    // Create message record
    const { data: messageRecord, error: messageError } = await supabase
      .from('messages')
      .insert({
        message_id: message.message_id,
        chat_id: message.chat.id,
        sender_info: message.from || message.sender_chat || {},
        message_type: determineMessageType(message),
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
        message_media_data: messageData
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
      chat_id: messageRecord.chat_id
    });

    return {
      success: true,
      message: 'Message processed successfully',
      messageId: messageRecord.id,
      data: {
        telegram_data: messageRecord.telegram_data,
        message_media_data: messageData,
        status: messageRecord.status
      }
    };

  } catch (error) {
    console.error('Error processing webhook message:', error);
    throw error;
  }
}

function determineMessageType(message: any): string {
  if (message.photo && message.photo.length > 0) return 'photo';
  if (message.video) return 'video';
  if (message.document) return 'document';
  if (message.animation) return 'animation';
  return 'text';
}