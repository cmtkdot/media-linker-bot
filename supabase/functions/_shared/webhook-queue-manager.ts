import { WebhookMessageData } from './webhook-message-builder.ts';

export async function queueWebhookMessage(
  supabase: any,
  messageData: WebhookMessageData,
  correlationId: string,
  messageType: string
) {
  console.log('Queueing webhook message:', {
    message_id: messageData.message.message_id,
    media_group_id: messageData.message.media_group_id,
    message_type: messageType,
    correlation_id: correlationId
  });

  const queueData = {
    queue_type: messageData.message.media_group_id ? 'media_group' : 
                messageType === 'text' ? 'webhook' : 'media',
    message_media_data: messageData,
    status: 'pending',
    correlation_id: correlationId,
    chat_id: messageData.message.chat_id,
    message_id: messageData.message.message_id
  };

  const { error: queueError } = await supabase
    .from('unified_processing_queue')
    .insert([queueData]);

  if (queueError) {
    console.error('Error queueing message:', queueError);
    throw queueError;
  }

  return queueData;
}