import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { WebhookMessageData } from './webhook-message-builder.ts';

export async function queueWebhookMessage(
  supabase: any,
  messageData: WebhookMessageData,
  correlationId: string,
  messageType: string
): Promise<void> {
  console.log('Queueing webhook message:', {
    message_id: messageData.message.message_id,
    message_type: messageType,
    media_group_id: messageData.message.media_group_id,
    is_original_caption: messageData.meta.is_original_caption
  });

  try {
    const { error } = await supabase
      .from('unified_processing_queue')
      .insert({
        queue_type: messageData.message.media_group_id ? 'media_group' : 'media',
        message_media_data: messageData,
        correlation_id: correlationId,
        chat_id: messageData.message.chat_id,
        message_id: messageData.message.message_id,
        priority: messageData.message.media_group_id ? 2 : 1
      });

    if (error) {
      // If it's a duplicate, we can safely ignore it
      if (error.code === '23505') {
        console.log('Message already queued:', {
          message_id: messageData.message.message_id,
          correlation_id: correlationId
        });
        return;
      }
      throw error;
    }

    console.log('Successfully queued message:', {
      message_id: messageData.message.message_id,
      correlation_id: correlationId
    });
  } catch (error) {
    console.error('Error queueing webhook message:', error);
    throw error;
  }
}