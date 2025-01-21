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

    // Check for existing media with same file_unique_id
    const { data: existingMedia } = await supabase
      .from('telegram_media')
      .select('*')
      .eq('file_unique_id', mediaFile.file_unique_id)
      .maybeSingle();

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
        // Continue processing even if caption analysis fails
      }
    }

    // Step 3: Try to process message, but don't stop if it fails
    let messageRecord = null;
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
        console.error('Message processing warning:', messageResult.error);
        // Continue with media processing even if message processing failed
      }
    } catch (error) {
      console.error('Message processing error:', error);
      // Continue with media processing even if message processing failed
    }

    // Step 4: Process media with gathered data
    const mediaResult = await processMedia(
      supabase,
      message,
      messageRecord, // This might be null, and that's okay
      botToken,
      productInfo,
      0,
      existingMedia
    );

    // Step 5: If media processing succeeded but message failed, try to create/update message again
    if (mediaResult && !messageRecord) {
      try {
        const { data: newMessage, error: messageError } = await supabase
          .from('messages')
          .upsert({
            message_id: message.message_id,
            chat_id: message.chat.id,
            sender_info: message.from || message.sender_chat || {},
            message_type: mediaType,
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
      }
    }

    // Step 6: Clean up old failed records
    await cleanupFailedRecords(supabase);

    console.log('Successfully processed update:', {
      update_id: update.update_id,
      message_id: message.message_id,
      chat_id: message.chat.id,
      media_result: mediaResult
    });

    return { 
      message: 'Media processed successfully', 
      messageId: messageRecord?.id, 
      ...mediaResult 
    };

  } catch (error) {
    console.error('Error in handleWebhookUpdate:', {
      error: error.message,
      stack: error.stack,
      update_id: update.update_id,
      message_id: message?.message_id || 'undefined',
      chat_id: message?.chat?.id || 'undefined'
    });

    // Even if message processing failed, try to process/update media
    try {
      const result = await processMedia(
        supabase,
        message,
        null, // No message record in error case
        botToken,
        productInfo,
        0,
        existingMedia
      );

      return {
        message: 'Media processed successfully despite message processing issues',
        ...result
      };
    } catch (mediaError) {
      console.error('Failed to process media after message failure:', mediaError);
      throw mediaError;
    }
  }
}