import { TelegramUpdate } from './telegram-types.ts';
import { analyzeCaptionWithAI } from './caption-analyzer.ts';
import { handleMessageProcessing } from './message-manager.ts';
import { processMedia } from './media-handler.ts';
import { cleanupFailedRecords } from './cleanup-manager.ts';
import { handleProcessingError } from './error-handler.ts';
import { delay } from './retry-utils.ts';

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
                message.animation ? 'animation' : 'unknown',
    media_group_id: message.media_group_id
  });

  let messageRecord = null;
  let productInfo = null;
  let mediaResult = null;

  try {
    // Step 1: Analyze caption if present
    if (message.caption) {
      try {
        console.log('Starting caption analysis...');
        productInfo = await analyzeCaptionWithAI(
          message.caption,
          Deno.env.get('SUPABASE_URL') || '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        );
        console.log('Caption analysis completed:', productInfo);
        // Add small delay after caption analysis
        await delay(500);
      } catch (error) {
        console.error('Caption analysis error:', error);
      }
    }

    // Step 2: Process message first to ensure we have a message record
    try {
      console.log('Creating/updating message record...');
      const messageResult = await handleMessageProcessing(
        supabase,
        message,
        null,
        productInfo
      );
      
      if (messageResult.success) {
        messageRecord = messageResult.messageRecord;
        console.log('Message record created/updated:', messageRecord?.id);
        // Add delay after message creation
        await delay(1000);
      } else {
        if (messageResult.error?.includes('duplicate')) {
          console.log('Duplicate message detected, retrieving existing record...');
          
          const { data: existingMessage } = await supabase
            .from('messages')
            .select('*')
            .eq('message_id', message.message_id)
            .eq('chat_id', message.chat.id)
            .maybeSingle();
          
          if (existingMessage) {
            messageRecord = existingMessage;
            console.log('Retrieved existing message record:', messageRecord.id);
          } else {
            console.log('Logging duplicate message in failed_webhook_updates...');
            await supabase.from('failed_webhook_updates').insert({
              message_id: message.message_id,
              chat_id: message.chat.id,
              error_message: 'Duplicate message upload detected',
              message_data: message,
              status: 'duplicate'
            });
            
            return {
              success: false,
              error: 'Duplicate message detected',
              messageId: null
            };
          }
        } else {
          console.error('Message processing error:', messageResult.error);
          throw new Error(messageResult.error);
        }
      }
    } catch (error) {
      console.error('Error in message processing:', error);
      throw error;
    }

    // Step 3: Process media with gathered data
    if (messageRecord) {
      try {
        console.log('Starting media processing...');
        // Add delay before media processing
        await delay(1000);
        
        mediaResult = await processMedia(
          supabase,
          message,
          messageRecord,
          botToken,
          productInfo,
          0
        );

        console.log('Media processing completed:', mediaResult);

        // Step 4: Handle media group synchronization
        if (message.media_group_id) {
          console.log('Handling media group synchronization...');
          // Add delay before group sync
          await delay(1500);
          
          const { error: groupUpdateError } = await supabase
            .from('telegram_media')
            .update({
              message_id: messageRecord.id,
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
            console.error('Error updating media group:', groupUpdateError);
          } else {
            console.log('Media group sync completed');
          }
        }

        // Step 5: Final message status update
        console.log('Updating final message status...');
        await delay(500);
        
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
          console.error('Error updating message status:', messageUpdateError);
        } else {
          console.log('Message status updated successfully');
        }
      } catch (error) {
        console.error('Error processing media:', error);
        throw error;
      }
    }

    // Step 6: Clean up old failed records
    try {
      await cleanupFailedRecords(supabase);
    } catch (error) {
      console.error('Error cleaning up failed records:', error);
    }

    console.log('Successfully processed update:', {
      update_id: update.update_id,
      message_id: message.message_id,
      chat_id: message.chat.id,
      media_result: mediaResult?.id,
      message_record: messageRecord?.id,
      media_group_id: message.media_group_id
    });

    return { 
      success: true,
      message: 'Processing completed',
      messageId: messageRecord?.id,
      mediaResult,
      productInfo
    };

  } catch (error) {
    console.error('Error in handleWebhookUpdate:', {
      error: error.message,
      stack: error.stack,
      update_id: update.update_id,
      message_id: message?.message_id,
      chat_id: message?.chat?.id
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