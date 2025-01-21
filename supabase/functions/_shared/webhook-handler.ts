import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { TelegramUpdate } from './telegram-types.ts';
import { analyzeCaption } from './telegram-service.ts';
import { createMessage } from './database-service.ts';
import { updateExistingMedia, processNewMedia } from './media-processor.ts';
import { handleProcessingError } from './error-handler.ts';
import { MAX_RETRY_ATTEMPTS } from './constants.ts';

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
    // Check for existing message
    const { data: existingMessage, error: fetchError } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', message.chat.id)
      .eq('message_id', message.message_id)
      .maybeSingle();

    if (fetchError) {
      console.error('Error checking for existing message:', {
        error: fetchError,
        message_id: message.message_id,
        chat_id: message.chat.id
      });
      throw fetchError;
    }

    let messageRecord = existingMessage;
    let retryCount = existingMessage?.retry_count || 0;

    // Create new message record if it doesn't exist
    if (!existingMessage) {
      try {
        let productInfo = null;
        if (message.caption) {
          console.log('Analyzing caption:', message.caption);
          productInfo = await analyzeCaption(
            message.caption,
            Deno.env.get('SUPABASE_URL') || '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
          );
        }
        messageRecord = await createMessage(supabase, message, productInfo);
        console.log('Created new message record:', {
          id: messageRecord.id,
          message_id: message.message_id
        });
      } catch (error) {
        console.error('Error creating message:', {
          error: error.message,
          message_id: message.message_id
        });
        throw error;
      }
    }

    // Update existing message status to processing
    if (existingMessage) {
      console.log('Updating existing message status:', {
        id: existingMessage.id,
        retry_count: retryCount
      });

      const { error: updateError } = await supabase
        .from('messages')
        .update({
          status: 'processing',
          retry_count: retryCount,
          last_retry_at: new Date().toISOString(),
        })
        .eq('id', existingMessage.id);

      if (updateError) {
        console.error('Error updating message status:', {
          error: updateError,
          message_id: existingMessage.id
        });
        throw updateError;
      }
    }

    while (retryCount < MAX_RETRY_ATTEMPTS) {
      try {
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

        console.log('Processing media file:', {
          file_id: mediaFile.file_id,
          type: mediaType,
          retry_count: retryCount
        });

        // Check for existing media
        const { data: existingMedia, error: mediaCheckError } = await supabase
          .from('telegram_media')
          .select('*')
          .eq('file_unique_id', mediaFile.file_unique_id)
          .maybeSingle();

        if (mediaCheckError) {
          console.error('Error checking for existing media:', {
            error: mediaCheckError,
            file_unique_id: mediaFile.file_unique_id
          });
          throw mediaCheckError;
        }

        let result;
        if (existingMedia) {
          console.log('Found existing media, updating records without re-upload:', {
            media_id: existingMedia.id,
            file_unique_id: mediaFile.file_unique_id
          });
          result = await updateExistingMedia(supabase, mediaFile, message, messageRecord);
        } else {
          console.log('Processing new media file:', {
            file_id: mediaFile.file_id,
            type: mediaType
          });
          result = await processNewMedia(
            supabase,
            mediaFile,
            mediaType,
            message,
            messageRecord,
            botToken,
            messageRecord.product_info
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
          console.error('Error updating message status:', {
            error: statusError,
            message_id: messageRecord.id
          });
          throw statusError;
        }

        console.log('Successfully processed message:', {
          message_id: messageRecord.id,
          media_type: mediaType
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
    throw error;
  }
}
