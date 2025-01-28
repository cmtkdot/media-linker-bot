import { WebhookUpdate } from "./types/telegram-types.ts";
import { MessageMediaData } from "./types/message-types.ts";

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

    // Build message data
    const messageUrl = `https://t.me/c/${Math.abs(message.chat.id)}/${message.message_id}`;
    
    const messageMediaData: MessageMediaData = {
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
        analyzed_content: {},
      },
      meta: {
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'pending',
        error: null,
        is_original_caption: false,
        original_message_id: null
      },
      telegram_data: message
    };

    // Insert into messages table
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
        message_media_data: messageMediaData,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;

    // Queue for processing if it's a media message
    if (message.photo || message.video || message.document) {
      await queueForProcessing(supabase, messageMediaData, correlationId);
    }

    return {
      success: true,
      message: 'Message processed successfully',
      messageId: messageRecord.id,
      data: {
        telegram_data: messageRecord.telegram_data,
        status: messageRecord.status
      }
    };
  } catch (error) {
    console.error('Error in webhook handler:', error);
    throw error;
  }
}

async function queueForProcessing(supabase: any, messageMediaData: MessageMediaData, correlationId: string) {
  const { error } = await supabase
    .from('unified_processing_queue')
    .insert({
      queue_type: messageMediaData.message.media_group_id ? 'media_group' : 'media',
      message_media_data: messageMediaData,
      correlation_id: correlationId,
      status: 'pending'
    });

  if (error) throw error;
}