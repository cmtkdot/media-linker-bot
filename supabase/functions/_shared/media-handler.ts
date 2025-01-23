import { processMediaFile } from './database-service.ts';
import { handleProcessingError } from './error-handler.ts';
import { MAX_RETRY_ATTEMPTS } from './constants.ts';

export async function processMedia(
  supabase: any,
  message: any,
  messageRecord: any,
  botToken: string,
  productInfo: any,
  retryCount: number,
  existingMedia: any = null
) {
  console.log('Starting media processing:', {
    message_id: message?.message_id,
    chat_id: message?.chat?.id,
    retry_count: retryCount,
    has_existing_media: !!existingMedia
  });

  while (retryCount < MAX_RETRY_ATTEMPTS) {
    try {
      const mediaTypes = ['photo', 'video', 'document', 'animation'] as const;
      let mediaFile = null;
      let mediaType = '';

      // Determine media type and file
      for (const type of mediaTypes) {
        if (message[type]) {
          mediaFile = type === 'photo' 
            ? message[type][message[type].length - 1] // Get highest resolution photo
            : message[type];
          mediaType = type;
          break;
        }
      }

      if (!mediaFile) {
        throw new Error('No media file found in message');
      }

      console.log('Processing media file:', {
        type: mediaType,
        file_id: mediaFile.file_id,
        message_id: messageRecord?.id
      });

      // Process the media file
      const result = await processMediaFile(
        supabase,
        mediaFile,
        mediaType,
        message,
        messageRecord,
        botToken,
        productInfo
      );

      console.log('Media processing completed successfully:', {
        file_id: mediaFile.file_id,
        media_type: mediaType,
        result_id: result?.id
      });

      return result;

    } catch (error) {
      console.error('Error in processMedia:', {
        error: error.message,
        retry_count: retryCount,
        message_id: messageRecord?.id
      });

      retryCount++;
      
      if (messageRecord) {
        const errorResult = await handleProcessingError(
          supabase, 
          error, 
          messageRecord, 
          retryCount,
          retryCount >= MAX_RETRY_ATTEMPTS
        );

        if (!errorResult.shouldContinue) {
          throw error;
        }
      } else if (retryCount >= MAX_RETRY_ATTEMPTS) {
        throw error;
      }

      // Add delay before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
    }
  }

  throw new Error(`Processing failed after ${MAX_RETRY_ATTEMPTS} attempts`);
}