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
    console.log('No message in update');
    return { message: 'No message in update' };
  }

  const hasMedia = message.photo || message.video || message.document || message.animation;
  if (!hasMedia) {
    console.log('Not a media message, skipping');
    return { message: 'Not a media message, skipping' };
  }

  console.log('[Webhook Start]', {
    update_id: update.update_id,
    message_id: message.message_id,
    chat_id: message.chat.id,
    media_type: message.photo ? 'photo' : 
                message.video ? 'video' : 
                message.document ? 'document' : 
                message.animation ? 'animation' : 'unknown',
    media_group_id: message.media_group_id,
    timestamp: new Date().toISOString()
  });

  let messageRecord = null;
  let productInfo = null;
  let mediaResult = null;

  try {
    // Step 1: Analyze caption if present
    if (message.caption) {
      console.log('[Caption Analysis Start]', {
        message_id: message.message_id,
        caption: message.caption,
        timestamp: new Date().toISOString()
      });
      
      try {
        productInfo = await analyzeCaptionWithAI(
          message.caption,
          Deno.env.get('SUPABASE_URL') || '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        );
        console.log('[Caption Analysis Complete]', {
          message_id: message.message_id,
          product_info: productInfo,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('[Caption Analysis Error]', {
          message_id: message.message_id,
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Step 2: Process message and wait for completion
    console.log('[Message Processing Start]', {
      message_id: message.message_id,
      media_group_id: message.media_group_id,
      timestamp: new Date().toISOString()
    });

    const messageResult = await handleMessageProcessing(
      supabase,
      message,
      null,
      productInfo
    );

    if (!messageResult.success) {
      console.error('[Message Processing Error]', {
        message_id: message.message_id,
        error: messageResult.error,
        timestamp: new Date().toISOString()
      });
      throw new Error(messageResult.error);
    }

    messageRecord = messageResult.messageRecord;
    console.log('[Message Record Created]', {
      message_record_id: messageRecord?.id,
      message_id: message.message_id,
      timestamp: new Date().toISOString()
    });

    // Step 3: Wait for message record commit
    console.log('[Waiting for Message Commit]', {
      message_record_id: messageRecord?.id,
      timestamp: new Date().toISOString()
    });
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 4: If media group, sync group info first
    if (message.media_group_id) {
      console.log('[Media Group Sync Start]', {
        media_group_id: message.media_group_id,
        message_id: message.message_id,
        timestamp: new Date().toISOString()
      });
      
      // Get existing media in the group
      const { data: existingMedia, error: mediaQueryError } = await supabase
        .from('telegram_media')
        .select('*')
        .eq('telegram_data->media_group_id', message.media_group_id);

      if (mediaQueryError) {
        console.error('[Media Group Query Error]', {
          media_group_id: message.media_group_id,
          error: mediaQueryError,
          timestamp: new Date().toISOString()
        });
      } else {
        console.log('[Existing Media Found]', {
          media_group_id: message.media_group_id,
          count: existingMedia?.length || 0,
          timestamp: new Date().toISOString()
        });
      }

      // Wait for group sync to complete
      console.log('[Waiting for Media Group Sync]', {
        media_group_id: message.media_group_id,
        timestamp: new Date().toISOString()
      });
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Step 5: Process media with gathered data
    if (messageRecord) {
      try {
        console.log('[Media Processing Start]', {
          message_record_id: messageRecord.id,
          message_id: message.message_id,
          timestamp: new Date().toISOString()
        });

        mediaResult = await processMedia(
          supabase,
          message,
          messageRecord,
          botToken,
          productInfo,
          0
        );

        console.log('[Media Processing Complete]', {
          message_record_id: messageRecord.id,
          media_result: mediaResult?.id,
          timestamp: new Date().toISOString()
        });

        // Step 6: Update message final status
        console.log('[Updating Message Status]', {
          message_record_id: messageRecord.id,
          timestamp: new Date().toISOString()
        });

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
            error: messageUpdateError,
            timestamp: new Date().toISOString()
          });
        } else {
          console.log('[Message Status Updated]', {
            message_record_id: messageRecord.id,
            timestamp: new Date().toISOString()
          });
        }

        // Step 7: Final wait for triggers
        console.log('[Final Wait for Triggers]', {
          message_record_id: messageRecord.id,
          timestamp: new Date().toISOString()
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error('[Media Processing Error]', {
          message_record_id: messageRecord.id,
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        });
        throw error;
      }
    }

    // Step 8: Clean up old failed records
    try {
      await cleanupFailedRecords(supabase);
    } catch (error) {
      console.error('[Cleanup Error]', {
        error: error.message,
        timestamp: new Date().toISOString()
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