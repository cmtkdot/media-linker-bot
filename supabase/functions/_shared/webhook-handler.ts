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

  console.log('Processing message:', {
    message_id: message.message_id,
    chat_id: message.chat.id,
    media_type: message.photo ? 'photo' : 
                message.video ? 'video' : 
                message.document ? 'document' : 
                message.animation ? 'animation' : 'unknown'
  });

  try {
    // Step 1: Analyze caption first if present
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
      }
    }

    // Step 2: Check for existing message and media in parallel
    const [messageCheck, mediaCheck] = await Promise.all([
      supabase
        .from('messages')
        .select('*')
        .eq('chat_id', message.chat.id)
        .eq('message_id', message.message_id)
        .maybeSingle(),
      supabase
        .from('telegram_media')
        .select('*')
        .eq('file_unique_id', message.photo?.[0]?.file_unique_id || 
                             message.video?.file_unique_id || 
                             message.document?.file_unique_id || 
                             message.animation?.file_unique_id)
        .maybeSingle()
    ]);

    if (messageCheck.error) {
      console.error('Error checking for existing message:', messageCheck.error);
      throw messageCheck.error;
    }

    if (mediaCheck.error) {
      console.error('Error checking for existing media:', mediaCheck.error);
      throw mediaCheck.error;
    }

    const existingMessage = messageCheck.data;
    const existingMedia = mediaCheck.data;

    // Step 3: Process message with analyzed content
    const { messageRecord, retryCount } = await handleMessageProcessing(
      supabase,
      message,
      existingMessage,
      productInfo
    );

    // Step 4: Process media with all gathered data
    const result = await processMedia(
      supabase,
      message,
      messageRecord,
      botToken,
      productInfo,
      retryCount,
      existingMedia
    );

    // Step 5: Update message status on success
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

    // Step 6: Clean up old failed records
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