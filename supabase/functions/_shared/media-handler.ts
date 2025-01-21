import { processMediaFile } from './database-service.ts';
import { handleProcessingError } from './error-handler.ts';
import { MAX_RETRY_ATTEMPTS } from './constants.ts';

export async function processMedia(
  supabase: any,
  message: any,
  messageRecord: any,
  botToken: string,
  productInfo: any,
  retryCount: number
) {
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

      // Check for existing media within transaction
      const { data: existingMedia, error: mediaCheckError } = await supabase
        .from('telegram_media')
        .select('*')
        .eq('file_unique_id', mediaFile.file_unique_id)
        .maybeSingle();

      if (mediaCheckError) {
        throw mediaCheckError;
      }

      let result;
      if (existingMedia) {
        console.log('Found existing media, updating records:', {
          media_id: existingMedia.id,
          file_unique_id: mediaFile.file_unique_id
        });

        // Update existing media with new product info
        const { error: mediaUpdateError } = await supabase
          .from('telegram_media')
          .update({
            caption: message.caption,
            product_name: productInfo?.product_name,
            product_code: productInfo?.product_code,
            quantity: productInfo?.quantity,
            vendor_uid: productInfo?.vendor_uid,
            purchase_date: productInfo?.purchase_date,
            notes: productInfo?.notes,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingMedia.id);

        if (mediaUpdateError) {
          console.error('Error updating existing media:', mediaUpdateError);
          throw mediaUpdateError;
        }

        result = existingMedia;
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

      // Update message status
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
}