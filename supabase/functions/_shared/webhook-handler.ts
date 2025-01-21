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

  console.log('Starting webhook update processing:', {
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
      console.log('Starting caption analysis:', {
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
        console.log('Caption analysis completed:', {
          message_id: message.message_id,
          product_info: productInfo,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Caption analysis error:', {
          message_id: message.message_id,
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Step 2: Process message first and wait for completion
    console.log('Starting message processing:', {
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
      console.error('Message processing error:', {
        message_id: message.message_id,
        error: messageResult.error,
        timestamp: new Date().toISOString()
      });
      throw new Error(messageResult.error);
    }

    messageRecord = messageResult.messageRecord;
    console.log('Message record created/updated:', {
      message_record_id: messageRecord?.id,
      message_id: message.message_id,
      timestamp: new Date().toISOString()
    });

    // Step 3: Wait for message record to be fully committed
    console.log('Waiting for message record commit:', {
      message_record_id: messageRecord?.id,
      timestamp: new Date().toISOString()
    });
    await new Promise(resolve => setTimeout(resolve, 500));

    // Step 4: If this is part of a media group, sync the group info first
    if (message.media_group_id) {
      console.log('Starting media group sync:', {
        media_group_id: message.media_group_id,
        message_id: message.message_id,
        timestamp: new Date().toISOString()
      });
      
      const { error: groupUpdateError } = await supabase
        .from('telegram_media')
        .update({
          caption: message.caption || null,
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
        .eq('telegram_data->media_group_id', message.media_group_id);

      if (groupUpdateError) {
        console.error('Media group sync error:', {
          media_group_id: message.media_group_id,
          error: groupUpdateError,
          timestamp: new Date().toISOString()
        });
      } else {
        console.log('Media group sync completed:', {
          media_group_id: message.media_group_id,
          timestamp: new Date().toISOString()
        });
      }

      // Wait for group sync to complete
      console.log('Waiting for media group sync to complete:', {
        media_group_id: message.media_group_id,
        timestamp: new Date().toISOString()
      });
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Step 5: Process media with gathered data
    if (messageRecord) {
      try {
        console.log('Starting media processing:', {
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

        console.log('Media processing completed:', {
          message_record_id: messageRecord.id,
          media_result: mediaResult?.id,
          timestamp: new Date().toISOString()
        });

        // Step 6: Update message with final status
        console.log('Updating message final status:', {
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
          console.error('Error updating message status:', {
            message_record_id: messageRecord.id,
            error: messageUpdateError,
            timestamp: new Date().toISOString()
          });
        } else {
          console.log('Message status updated successfully:', {
            message_record_id: messageRecord.id,
            timestamp: new Date().toISOString()
          });
        }

        // Step 7: Final wait to ensure all triggers have completed
        console.log('Final wait for trigger completion:', {
          message_record_id: messageRecord.id,
          timestamp: new Date().toISOString()
        });
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error('Error in media processing:', {
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
      console.error('Error cleaning up failed records:', {
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }

    console.log('Webhook update processing completed successfully:', {
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
    console.error('Fatal error in handleWebhookUpdate:', {
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