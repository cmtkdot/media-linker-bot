import { corsHeaders } from './cors.ts';
import { validateWebhookUpdate } from './webhook-validator.ts';
import { handleProcessingError } from './error-handler.ts';
import { createMessage } from './message-manager.ts';
import { processMedia } from './media-processor.ts';
import { analyzeCaptionWithAI } from './caption-analyzer.ts';
import { TelegramWebhookUpdate } from './webhook-types.ts';

export async function handleWebhookUpdate(
  update: TelegramWebhookUpdate,
  supabase: any,
  botToken: string
) {
  const message = update.message || update.channel_post;
  
  if (!message) {
    console.log('[No Message] Update contains no message');
    return { message: 'No message to process' };
  }

  console.log('[Webhook] Processing update:', {
    update_id: update.update_id,
    message_id: message.message_id,
    chat_id: message.chat.id,
    media_group_id: message.media_group_id
  });

  try {
    // If it's a media group, wait briefly for all messages
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
        // Continue processing even if caption analysis fails
      }
    }

    // Create or update message record
    let messageRecord;
    try {
      messageRecord = await createMessage(supabase, message, productInfo);
      if (!messageRecord || !messageRecord.id) {
        throw new Error('Failed to create message record');
      }
      console.log('[Message] Created/Updated:', messageRecord.id);
    } catch (error) {
      console.error('[Message Creation Error]:', error);
      throw error;
    }

    // Process media only if we have a valid message record
    if (messageRecord && messageRecord.id) {
      try {
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
      } catch (mediaError) {
        console.error('[Media Processing Error]:', mediaError);
        throw mediaError;
      }
    } else {
      throw new Error('Invalid message record');
    }

  } catch (error) {
    console.error('[Webhook] Error:', {
      error: error.message,
      stack: error.stack,
      update_id: update.update_id,
      message_id: message?.message_id
    });

    await handleProcessingError(
      supabase,
      error,
      { message_id: message?.message_id, chat_id: message?.chat?.id },
      0,
      true
    );

    return {
      success: false,
      error: error.message
    };
  }
}