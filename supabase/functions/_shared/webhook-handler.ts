import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { TelegramUpdate } from './telegram-types.ts';
import { analyzeCaptionWithAI } from './caption-analyzer.ts';
import { handleMessageProcessing } from './message-manager.ts';
import { processMedia } from './media-handler.ts';
import { cleanupFailedRecords } from './cleanup-manager.ts';

export async function handleWebhookUpdate(
  update: TelegramUpdate,
  supabase: any,
  botToken: string
) {
  const message = update.message || update.channel_post;
  if (!message) {
    console.log('No message in update');
    return { message: 'No message in update' };
  }

  const hasMedia = message.photo || message.video || message.document || message.animation;
  if (!hasMedia) {
    console.log('Not a media message, skipping');
    return { message: 'Not a media message, skipping' };
  }

  console.log('Processing media message:', {
    message_id: message.message_id,
    chat_id: message.chat.id,
    media_type: message.photo ? 'photo' : 
                message.video ? 'video' : 
                message.document ? 'document' : 
                message.animation ? 'animation' : 'unknown'
  });

  try {
    // First, analyze caption if present
    let productInfo = null;
    if (message.caption) {
      try {
        productInfo = await analyzeCaptionWithAI(
          message.caption,
          Deno.env.get('SUPABASE_URL') || '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        );
        console.log('Caption analysis result:', productInfo);
      } catch (error) {
        console.error('Error analyzing caption:', error);
        // Continue processing even if caption analysis fails
      }
    }

    // Check for existing message
    const { data: existingMessage, error: fetchError } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', message.chat.id)
      .eq('message_id', message.message_id)
      .maybeSingle();

    if (fetchError) {
      console.error('Error checking for existing message:', {
        error: fetchError,
        message_id: message.message_id,
        chat_id: message.chat.id
      });
      throw fetchError;
    }

    // Process message and get updated record
    const { messageRecord, retryCount } = await handleMessageProcessing(
      supabase,
      message,
      existingMessage,
      productInfo
    );

    // Process media within transaction
    const result = await processMedia(
      supabase,
      message,
      messageRecord,
      botToken,
      productInfo,
      retryCount
    );

    // Update message status on success
    const { error: statusError } = await supabase
      .from('messages')
      .update({
        status: 'success',
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        analyzed_content: productInfo
      })
      .eq('id', messageRecord.id);

    if (statusError) {
      console.error('Error updating message status:', statusError);
      throw statusError;
    }

    // Clean up old failed records
    await cleanupFailedRecords(supabase);

    console.log('Successfully processed update:', {
      update_id: update.update_id,
      message_id: message.message_id,
      chat_id: message.chat.id,
      result
    });

    return { 
      message: 'Media processed successfully', 
      messageId: messageRecord.id, 
      ...result 
    };

  } catch (error) {
    console.error('Error in handleWebhookUpdate:', {
      error: error.message,
      stack: error.stack,
      message_id: message?.message_id,
      chat_id: message?.chat?.id
    });

    // Log to failed_webhook_updates table
    try {
      const { error: logError } = await supabase
        .from('failed_webhook_updates')
        .insert({
          message_id: message?.message_id,
          chat_id: message?.chat?.id,
          error_message: error.message,
          error_stack: error.stack,
          message_data: message,
          status: 'failed',
          retry_count: error.retryCount || 0
        });

      if (logError) {
        console.error('Error logging failed webhook:', logError);
      }
    } catch (logError) {
      console.error('Error logging to failed_webhook_updates:', logError);
    }

    throw error;
  }
}