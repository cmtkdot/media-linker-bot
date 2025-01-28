import { analyzeCaptionWithAI } from './caption-analyzer.ts';
import { buildWebhookMessageData } from './webhook-message-builder.ts';
import { analyzeWebhookMessage } from './webhook-message-analyzer.ts';
import { updateMediaStatus } from './media/status-updater.ts';

export async function handleWebhookUpdate(
  update: any,
  supabaseClient: any,
  correlationId: string,
  botToken: string
) {
  console.log('Processing webhook update:', {
    update_id: update.update_id,
    correlation_id: correlationId
  });

  try {
    const message = update.message || update.channel_post;
    if (!message) {
      throw new Error('No message found in update');
    }

    // Get existing messages in the same media group
    let existingGroupMessages = [];
    if (message.media_group_id) {
      const { data: groupMessages } = await supabaseClient
        .from('messages')
        .select('*')
        .eq('media_group_id', message.media_group_id);
      
      existingGroupMessages = groupMessages || [];
    }

    // Analyze message content
    const analyzedContent = await analyzeWebhookMessage(message, existingGroupMessages);
    
    // Build message URL
    const messageUrl = `https://t.me/c/${Math.abs(message.chat.id).toString()}/${message.message_id}`;
    
    // Build webhook message data
    const messageData = buildWebhookMessageData(message, messageUrl, analyzedContent);
    
    // Insert message into database
    const { data: insertedMessage, error: insertError } = await supabaseClient
      .from('messages')
      .insert({
        message_id: message.message_id,
        chat_id: message.chat.id,
        sender_info: message.from || message.sender_chat || {},
        message_type: getMessageType(message),
        telegram_data: message,
        media_group_id: message.media_group_id,
        correlation_id: correlationId,
        message_url: messageUrl,
        message_media_data: messageData,
        is_original_caption: analyzedContent.is_original_caption,
        original_message_id: analyzedContent.original_message_id,
        analyzed_content: analyzedContent.analyzed_content,
        status: 'pending',
        retry_count: 0,
        max_retries: 3
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Update status after caption processing
    await updateMediaStatus(
      supabaseClient,
      insertedMessage.id,
      analyzedContent.analyzed_content ? 'processed' : 'pending'
    );

    return {
      success: true,
      message_id: insertedMessage.id,
      correlation_id: correlationId
    };

  } catch (error) {
    console.error('Error in webhook handler:', error);
    throw error;
  }
}

function getMessageType(message: any): string {
  if (message.photo) return 'photo';
  if (message.video) return 'video';
  if (message.document) return 'document';
  if (message.animation) return 'animation';
  return 'text';
}