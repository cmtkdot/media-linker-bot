import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { TelegramUpdate } from './telegram-types.ts';
import { analyzeCaption } from './telegram-service.ts';
import { createMessage } from './database-service.ts';
import { updateExistingMedia, processNewMedia } from './media-processor.ts';
import { handleProcessingError } from './error-handler.ts';
import { MAX_RETRY_ATTEMPTS } from './constants.ts';

async function checkForDuplicateMedia(supabase: any, mediaFile: any) {
  const { data: existingMedia, error } = await supabase
    .from('telegram_media')
    .select('*')
    .eq('file_unique_id', mediaFile.file_unique_id)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
    throw error;
  }

  return existingMedia;
}

async function updateMessageWithAnalyzedData(supabase: any, messageId: string, analyzedData: any) {
  console.log('Updating message with analyzed data:', {
    message_id: messageId,
    analyzed_data: analyzedData
  });

  const { error } = await supabase
    .from('messages')
    .update({
      caption: analyzedData.caption,
      product_name: analyzedData.product_name,
      product_code: analyzedData.product_code,
      quantity: analyzedData.quantity,
      vendor_uid: analyzedData.vendor_uid,
      purchase_date: analyzedData.purchase_date,
      notes: analyzedData.notes,
      updated_at: new Date().toISOString()
    })
    .eq('id', messageId);

  if (error) {
    console.error('Error updating message with analyzed data:', error);
    throw error;
  }
}

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

  console.log('Processing media message:', {
    message_id: message.message_id,
    chat_id: message.chat.id,
    media_type: message.photo ? 'photo' : 
                message.video ? 'video' : 
                message.document ? 'document' : 
                message.animation ? 'animation' : 'unknown'
  });

  try {
    // First analyze caption if present
    let productInfo = null;
    if (message.caption) {
      console.log('Analyzing caption:', message.caption);
      try {
        productInfo = await analyzeCaption(
          message.caption,
          Deno.env.get('SUPABASE_URL') || '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        );
        console.log('Caption analysis result:', productInfo);
      } catch (error) {
        console.error('Error analyzing caption:', error);
      }
    }

    // Get media file info
    const mediaTypes = ['photo', 'video', 'document', 'animation'] as const;
    let mediaFile = null;
    let mediaType = '';

    for (const type of mediaTypes) {
      if (message[type]) {
        mediaFile = type === 'photo' 
          ? message[type]![message[type]!.length - 1] 
          : message[type];
        mediaType = type;
        break;
      }
    }

    if (!mediaFile) {
      throw new Error('No media file found in message');
    }

    // Check for existing media before processing
    console.log('Checking for duplicate media:', mediaFile.file_unique_id);
    const existingMedia = await checkForDuplicateMedia(supabase, mediaFile);

    let messageRecord;
    let retryCount = 0;

    // Create or update message record with analyzed data
    if (existingMedia) {
      console.log('Found existing media, checking for message:', existingMedia.message_id);
      const { data: existingMessage } = await supabase
        .from('messages')
        .select('*')
        .eq('id', existingMedia.message_id)
        .single();

      if (existingMessage) {
        messageRecord = existingMessage;
        // Update existing message with new analyzed data
        await updateMessageWithAnalyzedData(supabase, existingMessage.id, {
          ...productInfo,
          caption: message.caption
        });
      }
    }

    // If no existing message, create new one
    if (!messageRecord) {
      try {
        const messageData = {
          ...message,
          ...productInfo
        };
        messageRecord = await createMessage(supabase, messageData);
        console.log('Created new message record:', {
          id: messageRecord.id,
          message_id: message.message_id,
          product_info: productInfo
        });
      } catch (error) {
        if (error.message === 'Duplicate file_id found in message_data') {
          console.log('Duplicate media detected, updating existing records');
          await supabase.from('failed_webhook_updates').insert({
            message_id: message.message_id,
            chat_id: message.chat.id,
            error_message: error.message,
            message_data: message,
            status: 'duplicate'
          });
          return {
            error: 'Duplicate media file',
            details: error.message
          };
        }
        throw error;
      }
    }

    // Process media with retry logic
    while (retryCount < MAX_RETRY_ATTEMPTS) {
      try {
        console.log('Processing media file:', {
          file_id: mediaFile.file_id,
          type: mediaType,
          retry_count: retryCount,
          product_info: productInfo
        });

        let result;
        if (existingMedia) {
          console.log('Updating existing media records:', {
            media_id: existingMedia.id,
            file_unique_id: mediaFile.file_unique_id,
            product_info: productInfo
          });
          result = await updateExistingMedia(supabase, mediaFile, message, messageRecord);
        } else {
          console.log('Processing new media file:', {
            file_id: mediaFile.file_id,
            type: mediaType,
            product_info: productInfo
          });
          result = await processNewMedia(
            supabase,
            mediaFile,
            mediaType,
            message,
            messageRecord,
            botToken,
            productInfo
          );
        }

        // Update message status to success
        const { error: statusError } = await supabase
          .from('messages')
          .update({
            status: 'success',
            processed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', messageRecord.id);

        if (statusError) {
          throw statusError;
        }

        console.log('Successfully processed message:', {
          message_id: messageRecord.id,
          media_type: mediaType,
          product_info: productInfo
        });

        return { 
          message: 'Media processed successfully', 
          messageId: messageRecord.id, 
          ...result 
        };

      } catch (error) {
        retryCount++;
        await handleProcessingError(supabase, error, messageRecord, retryCount);
      }
    }

    throw new Error(`Processing failed after ${MAX_RETRY_ATTEMPTS} attempts`);
  } catch (error) {
    console.error('Error in handleWebhookUpdate:', {
      error: error.message,
      stack: error.stack,
      message_id: message?.message_id,
      chat_id: message?.chat?.id
    });
    
    await supabase.from('failed_webhook_updates').insert({
      message_id: message?.message_id,
      chat_id: message?.chat?.id,
      error_message: error.message,
      error_stack: error.stack,
      message_data: message,
      status: 'failed'
    });
    
    throw error;
  }
}