import { processMediaFile } from './database-service.ts';
import { handleProcessingError } from './error-handler.ts';
import { MAX_RETRY_ATTEMPTS } from './constants.ts';

// Helper function to sanitize product name for file names
function sanitizeProductName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-') // Replace non-alphanumeric chars with hyphens
    .replace(/-+/g, '-')        // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, '');     // Remove leading/trailing hyphens
}

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
    has_existing_media: !!existingMedia,
    has_message_record: !!messageRecord,
    product_info: productInfo
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
            ? message[type][message[type].length - 1]
            : message[type];
          mediaType = type;
          break;
        }
      }

      if (!mediaFile) {
        throw new Error('No media file found in message');
      }

      // Get existing media count for this product to ensure unique naming
      const { data: existingCount } = await supabase
        .from('telegram_media')
        .select('id')
        .eq('product_name', productInfo?.product_name || '')
        .count();

      const count = existingCount?.count || 0;
      const productNamePart = sanitizeProductName(productInfo?.product_name || '');
      const sequentialNumber = count + 1;
      
      // Create unique file name with product info
      const uniqueId = mediaFile.file_unique_id;
      const baseFileName = productNamePart 
        ? `${productNamePart}-${sequentialNumber}-${uniqueId}`
        : uniqueId;

      // Update mediaFile with new naming convention
      mediaFile = {
        ...mediaFile,
        customFileName: baseFileName
      };

      console.log('Processing media file:', {
        type: mediaType,
        file_id: mediaFile.file_id,
        message_id: messageRecord?.id,
        custom_file_name: baseFileName
      });

      // Check for existing media first
      const { data: existingMediaRecord } = await supabase
        .from('telegram_media')
        .select('*')
        .eq('file_unique_id', mediaFile.file_unique_id)
        .maybeSingle();

      if (existingMediaRecord) {
        console.log('Found existing media record:', {
          id: existingMediaRecord.id,
          file_unique_id: existingMediaRecord.file_unique_id
        });

        // Update existing record with new message_id if available
        if (messageRecord?.id && !existingMediaRecord.message_id) {
          const { error: updateError } = await supabase
            .from('telegram_media')
            .update({ message_id: messageRecord.id })
            .eq('id', existingMediaRecord.id);

          if (updateError) {
            console.error('Error updating message_id:', updateError);
          }
        }

        return existingMediaRecord;
      }

      // Process the media file even without message_id
      const result = await processMediaFile(
        supabase,
        mediaFile,
        mediaType,
        message,
        messageRecord || null,
        botToken,
        productInfo
      );

      console.log('Media processing completed successfully:', {
        file_id: mediaFile.file_id,
        media_type: mediaType,
        result_id: result?.id,
        has_message_id: !!messageRecord
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