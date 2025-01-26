import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { processMediaFiles } from './media-processor.ts';
import { withDatabaseRetry } from './database-retry.ts';
import { analyzeCaptionWithAI } from './caption-analyzer.ts';

export async function handleWebhookUpdate(
  update: any, 
  supabase: any, 
  botToken: string,
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
      correlation_id: correlationId
    });

    // Generate message URL
    const chatId = message.chat.id.toString();
    const messageUrl = `https://t.me/c/${chatId.substring(4)}/${message.message_id}`;

    // Create message media data structure
    const messageMediaData = {
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
        chat_info: message.chat || {}
      },
      meta: {
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'pending',
        error: null,
        correlation_id: correlationId
      }
    };

    // Create or update message record with retry
    const messageRecord = await withDatabaseRetry(async () => {
      const messageData = {
        message_id: message.message_id,
        chat_id: message.chat.id,
        sender_info: message.from || message.sender_chat || {},
        message_type: determineMessageType(message),
        telegram_data: message,
        caption: message.caption,
        media_group_id: message.media_group_id,
        message_url: messageUrl,
        status: 'pending',
        correlation_id: correlationId
      };

      console.log('Creating/updating message record:', {
        message_id: message.message_id,
        chat_id: message.chat.id,
        correlation_id: correlationId
      });

      const { data: existingMessage } = await supabase
        .from('messages')
        .select('*')
        .eq('message_id', message.message_id)
        .eq('chat_id', message.chat.id)
        .maybeSingle();

      if (existingMessage) {
        const { data, error: updateError } = await supabase
          .from('messages')
          .update(messageData)
          .eq('id', existingMessage.id)
          .select()
          .single();

        if (updateError) throw updateError;
        return data;
      } else {
        const { data, error: insertError } = await supabase
          .from('messages')
          .insert([messageData])
          .select()
          .single();

        if (insertError) throw insertError;
        return data;
      }
    });

    console.log('Message record created/updated:', {
      record_id: messageRecord?.id,
      correlation_id: correlationId
    });

    // The queue_webhook_message trigger will automatically add this to unified_processing_queue
    // with the correct queue_type (either 'media' or 'webhook')
    
    return {
      success: true,
      message: 'Update processed successfully',
      messageId: messageRecord?.id,
      correlationId
    };

  } catch (error) {
    console.error('Error in webhook handler:', {
      error: error.message,
      stack: error.stack,
      update_id: update.update_id,
      message_id: message?.message_id,
      chat_id: message?.chat?.id,
      correlation_id: correlationId
    });
    throw error;
  }
}

function determineMessageType(message: any): string {
  if (message.photo && message.photo.length > 0) return 'photo';
  if (message.video) return 'video';
  if (message.document) return 'document';
  if (message.animation) return 'animation';
  return 'unknown';
}
