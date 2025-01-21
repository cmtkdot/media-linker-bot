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
  while (retryCount < MAX_RETRY_ATTEMPTS) {
    try {
      const mediaTypes = ['photo', 'video', 'document', 'animation'] as const;
      let mediaFile = null;
      let mediaType = '';

      for (const type of mediaTypes) {
        if (message[type]) {
          mediaFile = type === 'photo' 
            ? message[type][message[type].length - 1] 
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
        retry_count: retryCount,
        existing: !!existingMedia
      });

      let result;
      if (existingMedia) {
        console.log('Checking existing media:', {
          media_id: existingMedia.id,
          file_unique_id: mediaFile.file_unique_id
        });
        
        // Check if media needs reprocessing
        const needsReprocessing = !existingMedia.processed || 
                                !existingMedia.public_url || 
                                existingMedia.processing_error;

        if (needsReprocessing) {
          result = await processMediaFile(
            supabase,
            mediaFile,
            mediaType,
            message,
            messageRecord,
            botToken,
            productInfo
          );
        } else {
          result = existingMedia;
        }
      } else {
        console.log('Processing new media file:', {
          file_id: mediaFile.file_id,
          type: mediaType
        });
        
        result = await processMediaFile(
          supabase,
          mediaFile,
          mediaType,
          message,
          messageRecord,
          botToken,
          productInfo
        );
      }

      return { 
        message: 'Media processed successfully', 
        messageId: messageRecord.id, 
        ...result 
      };

    } catch (error) {
      retryCount++;
      await handleProcessingError(supabase, error, messageRecord, retryCount);
      
      if (retryCount >= MAX_RETRY_ATTEMPTS) {
        throw error;
      }
    }
  }

  throw new Error(`Processing failed after ${MAX_RETRY_ATTEMPTS} attempts`);
}