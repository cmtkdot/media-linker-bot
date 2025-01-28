import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { WebhookUpdate, WebhookResponse } from '../../types/webhook-types';
import { MessageMediaData } from '../../types/message-types';
import { analyzeCaption } from '../../services/caption/caption-analyzer';

export async function processWebhookUpdate(
  supabase: any,
  update: WebhookUpdate,
  correlationId: string
): Promise<WebhookResponse> {
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
        product_name: undefined,
        product_code: undefined,
        quantity: undefined,
        vendor_uid: undefined,
        purchase_date: undefined,
        notes: undefined
      },
      meta: {
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'pending',
        error: null,
        is_original_caption: false,
        original_message_id: null,
        correlation_id: correlationId,
        processed_at: null,
        last_retry_at: null,
        retry_count: 0
      },
      media: message.photo ? {
        file_id: message.photo[message.photo.length - 1].file_id,
        file_unique_id: message.photo[message.photo.length - 1].file_unique_id,
        file_type: 'photo',
        mime_type: 'image/jpeg'
      } : message.video ? {
        file_id: message.video.file_id,
        file_unique_id: message.video.file_unique_id,
        file_type: 'video',
        mime_type: message.video.mime_type || 'video/mp4'
      } : message.document ? {
        file_id: message.document.file_id,
        file_unique_id: message.document.file_unique_id,
        file_type: 'document',
        mime_type: message.document.mime_type
      } : undefined,
      telegram_data: message
    };

    // Insert into messages table
    const { data: messageRecord, error } = await supabase
      .from('messages')
      .insert({
        message_id: message.message_id,
        chat_id: message.chat.id,
        sender_info: message.from || message.sender_chat || {},
        message_type: message.photo ? 'photo' : message.video ? 'video' : message.document ? 'document' : 'text',
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

async function queueForProcessing(
  supabase: any,
  messageMediaData: MessageMediaData,
  correlationId: string
): Promise<void> {
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