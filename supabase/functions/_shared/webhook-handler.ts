import { WebhookUpdate, TelegramMessage } from "../types/telegram-types.ts";
import { analyzeWebhookMessage } from "../webhook-message-analyzer.ts";
import { buildWebhookMessageData } from "../webhook-message-builder.ts";
import { queueWebhookMessage } from "./queue/queue-manager.ts";

export async function handleWebhookUpdate(
  supabase: any,
  update: WebhookUpdate,
  correlationId: string
) {
  const message = update.message || update.channel_post;
  
  if (!message) {
    console.log('No message in update');
    return { success: false, message: 'No message found in update' };
  }

  try {
    console.log('Processing webhook update:', {
      message_id: message.message_id,
      chat_id: message.chat.id,
      media_group_id: message.media_group_id,
      correlation_id: correlationId
    });

    // Build message data with proper structure
    const messageUrl = `https://t.me/c/${Math.abs(message.chat.id)}/${message.message_id}`;
    const analyzedContent = await analyzeWebhookMessage(message);
    const messageData = buildWebhookMessageData(message, messageUrl, analyzedContent);

    // Insert into messages table with complete structure
    const { data: messageRecord, error } = await supabase
      .from('messages')
      .insert({
        message_id: message.message_id,
        chat_id: message.chat.id,
        sender_info: message.from || message.sender_chat || {},
        message_type: message.photo ? 'photo' : message.video ? 'video' : 'text',
        telegram_data: message,
        media_group_id: message.media_group_id,
        message_url: messageUrl,
        correlation_id: correlationId,
        message_media_data: messageData,
        is_original_caption: analyzedContent.is_original_caption,
        original_message_id: analyzedContent.original_message_id,
        analyzed_content: analyzedContent.analyzed_content,
        caption: message.caption,
        media_group_size: message.media_group_id ? await getMediaGroupSize(supabase, message) : null,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;

    // Queue for processing if it's a media message
    if (message.photo || message.video || message.document) {
      await queueWebhookMessage(supabase, messageData, correlationId, 'media');
    }

    return {
      success: true,
      message: 'Message processed successfully',
      messageId: messageRecord.id,
      data: {
        analyzed_content: messageRecord.analyzed_content,
        telegram_data: messageRecord.telegram_data,
        status: messageRecord.status
      }
    };
  } catch (error) {
    console.error('Error in webhook handler:', error);
    throw error;
  }
}

async function getMediaGroupSize(supabase: any, message: TelegramMessage): Promise<number> {
  if (!message.media_group_id) return 0;
  
  const { count } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('media_group_id', message.media_group_id);
    
  return count + 1; // Include current message
}