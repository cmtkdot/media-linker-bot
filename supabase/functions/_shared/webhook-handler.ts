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
    // Step 1: Check for existing telegram_media record
    const mediaType = message.photo ? 'photo' : 
                     message.video ? 'video' : 
                     message.document ? 'document' : 
                     message.animation ? 'animation' : null;
    
    const mediaFile = mediaType === 'photo' ? 
      message.photo[message.photo.length - 1] : 
      message[mediaType];

    if (!mediaFile) {
      throw new Error('No media file found in message');
    }

    const { data: existingMedia } = await supabase
      .from('telegram_media')
      .select('*')
      .eq('file_unique_id', mediaFile.file_unique_id)
      .single();

    // Step 2: Analyze caption if present
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
        // Continue flow even if caption analysis fails
      }
    }

    // Step 3: Process message and create/update record
    const { messageRecord, retryCount } = await handleMessageProcessing(
      supabase,
      message,
      null, // No existing message for new updates
      productInfo
    );

    if (!messageRecord) {
      console.warn('No message record created, but continuing with media processing');
    }

    // Step 4: Process media with gathered data
    const result = await processMedia(
      supabase,
      message,
      messageRecord,
      botToken,
      productInfo,
      retryCount || 0,
      existingMedia
    );

    // Step 5: If media processing succeeded, mark message as success
    if (messageRecord) {
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
        // Don't throw error here, as media processing succeeded
      }
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
      messageId: messageRecord?.id, 
      ...result 
    };

  } catch (error) {
    console.error('Error in handleWebhookUpdate:', {
      error: error.message,
      stack: error.stack,
      update_id: update.update_id,
      message_id: message?.message_id || 'undefined',
      chat_id: message?.chat?.id || 'undefined'
    });

    // Even if message processing failed, try to update telegram_media
    if (error.message.includes('Failed to create message record')) {
      try {
        const result = await processMedia(
          supabase,
          message,
          null, // No message record
          botToken,
          productInfo,
          0,
          existingMedia
        );

        return {
          message: 'Media processed successfully despite message creation failure',
          ...result
        };
      } catch (mediaError) {
        console.error('Failed to process media after message failure:', mediaError);
        throw mediaError;
      }
    }

    throw error;
  }
}