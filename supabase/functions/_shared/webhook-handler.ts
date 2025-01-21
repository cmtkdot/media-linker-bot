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

  console.log('Processing message:', {
    message_id: message.message_id,
    chat_id: message.chat.id,
    media_type: message.photo ? 'photo' : 
                message.video ? 'video' : 
                message.document ? 'document' : 
                message.animation ? 'animation' : 'unknown'
  });

  let messageRecord = null;
  let productInfo = null;
  let mediaResult = null;

  try {
    // Step 1: Analyze caption if present
    if (message.caption) {
      try {
        productInfo = await analyzeCaptionWithAI(
          message.caption,
          Deno.env.get('SUPABASE_URL') || '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        );
        console.log('Caption analysis result:', productInfo);
      } catch (error) {
        console.error('Caption analysis error:', error);
        // Continue processing even if caption analysis fails
      }
    }

    // Step 2: Try to process message
    try {
      const messageResult = await handleMessageProcessing(
        supabase,
        message,
        null,
        productInfo
      );
      
      if (messageResult.success) {
        messageRecord = messageResult.messageRecord;
      } else {
        console.warn('Message processing warning:', messageResult.error);
      }
    } catch (error) {
      await handleProcessingError(supabase, error, { 
        message_id: message.message_id,
        chat_id: message.chat.id,
        message_data: message
      }, 0, false);
      // Continue with media processing even if message processing failed
    }

    // Step 3: Process media with gathered data
    try {
      mediaResult = await processMedia(
        supabase,
        message,
        messageRecord,
        botToken,
        productInfo,
        0
      );

      // Step 4: If media processing succeeded but message failed, try to create/update message again
      if (mediaResult && !messageRecord) {
        try {
          const { data: newMessage, error: messageError } = await supabase
            .from('messages')
            .upsert({
              message_id: message.message_id,
              chat_id: message.chat.id,
              sender_info: message.from || message.sender_chat || {},
              message_type: message.photo ? 'photo' : 
                          message.video ? 'video' : 
                          message.document ? 'document' : 
                          message.animation ? 'animation' : 'unknown',
              message_data: message,
              caption: message.caption,
              media_group_id: message.media_group_id,
              status: 'success',
              processed_at: new Date().toISOString(),
              analyzed_content: productInfo
            }, {
              onConflict: 'message_id,chat_id',
              returning: 'representation'
            })
            .select()
            .maybeSingle();

          if (!messageError && newMessage) {
            messageRecord = newMessage;
            // Update telegram_media with message_id if needed
            if (mediaResult.id) {
              await supabase
                .from('telegram_media')
                .update({ message_id: messageRecord.id })
                .eq('id', mediaResult.id);
            }
          }
        } catch (error) {
          console.error('Error in secondary message creation:', error);
          // Continue since we already have the media processed
        }
      }
    } catch (error) {
      const errorResult = await handleProcessingError(
        supabase,
        error,
        messageRecord,
        0,
        false
      );
      
      if (!errorResult.shouldContinue) {
        return {
          success: false,
          error: error.message,
          partial_success: !!mediaResult
        };
      }
    }

    // Step 5: Clean up old failed records
    try {
      await cleanupFailedRecords(supabase);
    } catch (error) {
      console.error('Error cleaning up failed records:', error);
      // Don't fail the whole process for cleanup errors
    }

    console.log('Successfully processed update:', {
      update_id: update.update_id,
      message_id: message.message_id,
      chat_id: message.chat.id,
      media_result: mediaResult
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
      message_id: message?.message_id || 'undefined',
      chat_id: message?.chat?.id || 'undefined'
    });

    // Even if the overall process failed, return any partial successes
    return {
      success: false,
      error: error.message,
      partial_success: !!mediaResult,
      mediaResult,
      messageId: messageRecord?.id
    };
  }
}