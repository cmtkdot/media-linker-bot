import { corsHeaders } from './cors.ts';
import { validateWebhookUpdate } from './webhook-validator.ts';
import { handleProcessingError } from './error-handler.ts';
import { createMessage, processMedia } from './database-service.ts';
import { analyzeCaptionWithAI } from './caption-analyzer.ts';
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

  console.log('[Webhook] Processing update:', {
    update_id: update.update_id,
    message_id: message.message_id,
    chat_id: message.chat.id,
    media_group_id: message.media_group_id
  });

  try {
    // Add delay for media groups
    if (message.media_group_id) {
      console.log('[Media Group] Waiting for completion:', message.media_group_id);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Analyze caption if present
    let productInfo = null;
    if (message.caption) {
      try {
        productInfo = await analyzeCaptionWithAI(
          message.caption,
          Deno.env.get('SUPABASE_URL') || '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        );
        console.log('[Caption Analysis] Complete:', productInfo);
      } catch (error) {
        console.error('[Caption Analysis] Error:', error);
      }
    }

    // Create or update message record
    const messageRecord = await createMessage(supabase, message, productInfo);
    console.log('[Message] Created/Updated:', messageRecord.id);

    // Process media
    const mediaResult = await processMedia(
      supabase,
      message,
      messageRecord,
      botToken,
      productInfo
    );

    console.log('[Webhook] Complete:', {
      update_id: update.update_id,
      message_id: message.message_id,
      media_result: mediaResult?.id
    });

    return { 
      success: true,
      messageId: messageRecord.id,
      mediaResult
    };

  } catch (error) {
    console.error('[Webhook] Error:', {
      error: error.message,
      stack: error.stack,
      update_id: update.update_id,
      message_id: message?.message_id
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