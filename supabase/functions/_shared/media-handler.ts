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
        existing: !!existingMedia,
        message_record: messageRecord?.id || 'none'
      });

      let result;
      if (existingMedia) {
        console.log('Checking existing media:', {
          media_id: existingMedia.id,
          file_unique_id: mediaFile.file_unique_id
        });
        
        // Always process media if it hasn't been processed successfully
        const needsProcessing = !existingMedia.processed || 
                              !existingMedia.public_url || 
                              existingMedia.processing_error ||
                              (productInfo && (
                                productInfo.product_name !== existingMedia.product_name ||
                                productInfo.product_code !== existingMedia.product_code ||
                                productInfo.quantity !== existingMedia.quantity ||
                                productInfo.vendor_uid !== existingMedia.vendor_uid ||
                                productInfo.purchase_date !== existingMedia.purchase_date
                              ));

        if (needsProcessing) {
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
        messageId: messageRecord?.id || 'none',
        ...result 
      };

    } catch (error) {
      retryCount++;
      
      // Only handle processing error if we have a message record
      if (messageRecord) {
        await handleProcessingError(supabase, error, messageRecord, retryCount);
      } else {
        console.error('Processing error without message record:', {
          error: error.message,
          retry_count: retryCount
        });
      }
      
      if (retryCount >= MAX_RETRY_ATTEMPTS) {
        throw error;
      }
    }
  }

  throw new Error(`Processing failed after ${MAX_RETRY_ATTEMPTS} attempts`);
}