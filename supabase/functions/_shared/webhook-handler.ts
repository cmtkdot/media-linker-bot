import { corsHeaders } from './cors.ts';
import { validateWebhookUpdate } from './webhook-validator.ts';
import { processWebhookUpdate } from './webhook-processor.ts';
import { cleanupFailedRecords } from './cleanup-manager.ts';
import { handleProcessingError } from './error-handler.ts';
import { TelegramWebhookUpdate } from './webhook-types.ts';

export async function handleWebhookUpdate(
  update: TelegramWebhookUpdate,
  supabase: any,
  botToken: string
) {
  const message = update.message || update.channel_post;
  
  if (!validateWebhookUpdate(update)) {
    return { message: 'Invalid or non-media message, skipping' };
  }

  console.log('[Webhook Processing] Starting update processing:', {
    update_id: update.update_id,
    message_id: message.message_id,
    chat_id: message.chat.id,
    media_group_id: message.media_group_id,
    timestamp: new Date().toISOString()
  });

  try {
    // Add delay for media groups to ensure all items are received
    if (message.media_group_id) {
      console.log('[Media Group Detected] Waiting for group completion...', {
        media_group_id: message.media_group_id
      });
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    const result = await processWebhookUpdate(message, supabase, botToken);
    
    console.log('[Webhook Complete]', {
      update_id: update.update_id,
      message_id: message.message_id,
      result
    });

    // Clean up old failed records
    try {
      await cleanupFailedRecords(supabase);
    } catch (error) {
      console.error('[Cleanup Error]', error);
    }

    return { 
      success: true,
      message: 'Processing completed',
      ...result
    };

  } catch (error) {
    console.error('[Fatal Error]', {
      error: error.message,
      stack: error.stack,
      update_id: update.update_id,
      message_id: message?.message_id,
      chat_id: message?.chat?.id,
      timestamp: new Date().toISOString()
    });

    if (message) {
      await handleProcessingError(
        supabase,
        error,
        { message_id: message.message_id, chat_id: message.chat.id },
        0,
        false
      );
    }

    return {
      success: false,
      error: error.message
    };
  }
}