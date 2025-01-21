import { TelegramUpdate } from './telegram-types.ts';
import { analyzeCaptionWithAI } from './caption-analyzer.ts';
import { handleMessageProcessing } from './message-manager.ts';
import { processMedia } from './media-handler.ts';
import { cleanupFailedRecords } from './cleanup-manager.ts';
import { handleProcessingError } from './error-handler.ts';

export async function handleWebhookUpdate(
  update: TelegramUpdate,
  supabase: any,
  botToken: string
) {
  const message = update.message || update.channel_post;
  if (!message) {
    console.log('[No Message] Update contains no message');
    return { message: 'No message in update' };
  }

  const hasMedia = message.photo || message.video || message.document || message.animation;
  if (!hasMedia) {
    console.log('[No Media] Not a media message, skipping');
    return { message: 'Not a media message, skipping' };
  }

  console.log('[Webhook Processing] Starting update processing:', {
    update_id: update.update_id,
    message_id: message.message_id,
    chat_id: message.chat.id,
    media_group_id: message.media_group_id,
    timestamp: new Date().toISOString()
  });

  let messageRecord = null;
  let productInfo = null;
  let mediaResult = null;

  try {
    // Step 1: Analyze caption if present
    if (message.caption) {
      console.log('[Caption Analysis] Starting...', {
        message_id: message.message_id,
        caption: message.caption
      });
      
      try {
        productInfo = await analyzeCaptionWithAI(
          message.caption,
          Deno.env.get('SUPABASE_URL') || '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        );
        console.log('[Caption Analysis] Complete', {
          message_id: message.message_id,
          product_info: productInfo
        });
      } catch (error) {
        console.error('[Caption Analysis Error]', {
          message_id: message.message_id,
          error: error.message
        });
      }
    }

    // Step 2: Process message
    console.log('[Message Processing] Starting...', {
      message_id: message.message_id,
      media_group_id: message.media_group_id
    });

    const messageResult = await handleMessageProcessing(
      supabase,
      message,
      null,
      productInfo
    );

    if (!messageResult.success) {
      throw new Error(messageResult.error);
    }

    messageRecord = messageResult.messageRecord;
    console.log('[Message Processing] Complete', {
      message_record_id: messageRecord?.id,
      message_id: message.message_id
    });

    // Step 3: Wait for message record commit
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 4: Process media with gathered data
    if (messageRecord) {
      try {
        console.log('[Media Processing] Starting...', {
          message_record_id: messageRecord.id,
          message_id: message.message_id
        });

        mediaResult = await processMedia(
          supabase,
          message,
          messageRecord,
          botToken,
          productInfo,
          0
        );

        console.log('[Media Processing] Complete', {
          message_record_id: messageRecord.id,
          media_result: mediaResult?.id
        });

        // Step 5: Update message final status
        const { error: messageUpdateError } = await supabase
          .from('messages')
          .update({
            status: 'success',
            processed_at: new Date().toISOString(),
            ...(productInfo && {
              product_name: productInfo.product_name,
              product_code: productInfo.product_code,
              quantity: productInfo.quantity,
              vendor_uid: productInfo.vendor_uid,
              purchase_date: productInfo.purchase_date,
              notes: productInfo.notes,
              analyzed_content: productInfo
            })
          })
          .eq('id', messageRecord.id);

        if (messageUpdateError) {
          console.error('[Message Status Update Error]', {
            message_record_id: messageRecord.id,
            error: messageUpdateError
          });
        }

        // Step 6: Final wait for triggers
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error('[Media Processing Error]', {
          message_record_id: messageRecord.id,
          error: error.message
        });
        throw error;
      }
    }

    // Step 7: Clean up old failed records
    try {
      await cleanupFailedRecords(supabase);
    } catch (error) {
      console.error('[Cleanup Error]', {
        error: error.message
      });
    }

    console.log('[Webhook Complete]', {
      update_id: update.update_id,
      message_id: message.message_id,
      chat_id: message.chat.id,
      media_result: mediaResult?.id,
      message_record: messageRecord?.id,
      media_group_id: message.media_group_id,
      timestamp: new Date().toISOString()
    });

    return { 
      success: true,
      message: 'Processing completed',
      messageId: messageRecord?.id,
      mediaResult,
      productInfo
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

    if (messageRecord) {
      await handleProcessingError(
        supabase,
        error,
        messageRecord,
        0,
        false
      );
    }

    return {
      success: false,
      error: error.message,
      partial_success: !!mediaResult,
      mediaResult,
      messageId: messageRecord?.id
    };
  }
}