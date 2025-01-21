import { getAndDownloadTelegramFile, generateSafeFileName } from './telegram-service.ts';
import { uploadMediaToStorage } from './storage-manager.ts';
import { validateMediaFile, getMimeType } from './media-validators.ts';
import { handleProcessingError } from './error-handler.ts';
import { MAX_RETRY_ATTEMPTS } from './constants.ts';

export async function processMedia(
  supabase: any,
  message: any,
  messageRecord: any,
  botToken: string,
  productInfo: any = null,
  retryCount = 0
) {
  while (retryCount < MAX_RETRY_ATTEMPTS) {
    try {
      const mediaTypes = ['photo', 'video', 'document', 'animation'] as const;
      let mediaFile = null;
      let mediaType = '';

      // Find the media file
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

      console.log('[Media] Processing:', {
        file_id: mediaFile.file_id,
        type: mediaType,
        retry_count: retryCount,
        media_group_id: message.media_group_id
      });

      // Validate media file
      await validateMediaFile(mediaFile, mediaType);

      // Check for existing media
      const { data: existingMedia, error: queryError } = await supabase
        .from('telegram_media')
        .select('*')
        .eq('file_unique_id', mediaFile.file_unique_id)
        .maybeSingle();

      if (queryError) throw queryError;

      // Download and process file
      const { buffer, filePath } = await getAndDownloadTelegramFile(mediaFile.file_id, botToken);
      const fileExt = filePath.split('.').pop() || '';
      const uniqueFileName = generateSafeFileName(
        productInfo?.product_name,
        productInfo?.product_code,
        mediaType,
        fileExt,
        message.media_group_id
      );

      // Upload to storage
      const { publicUrl } = await uploadMediaToStorage(
        supabase,
        buffer,
        uniqueFileName,
        getMimeType(filePath, mediaType === 'photo' ? 'image/jpeg' : 'application/octet-stream')
      );

      const telegramData = {
        message_id: message.message_id,
        chat_id: message.chat.id,
        sender_chat: message.sender_chat,
        chat: message.chat,
        date: message.date,
        caption: message.caption,
        media_group_id: message.media_group_id,
        file_size: mediaFile.file_size,
        mime_type: mediaFile.mime_type,
        width: mediaFile.width,
        height: mediaFile.height,
        duration: 'duration' in mediaFile ? mediaFile.duration : null,
        storage_path: uniqueFileName
      };

      if (existingMedia) {
        // Update existing media
        const { data: updatedMedia, error: updateError } = await supabase
          .from('telegram_media')
          .update({
            public_url: publicUrl,
            caption: message.caption,
            telegram_data: telegramData,
            ...(productInfo && {
              product_name: productInfo.product_name,
              product_code: productInfo.product_code,
              quantity: productInfo.quantity,
              vendor_uid: productInfo.vendor_uid,
              purchase_date: productInfo.purchase_date,
              notes: productInfo.notes,
              analyzed_content: productInfo
            })
          })
          .eq('id', existingMedia.id)
          .select()
          .single();

        if (updateError) throw updateError;
        return updatedMedia;
      } else {
        // Create new media record
        const { data: newMedia, error: insertError } = await supabase
          .from('telegram_media')
          .insert({
            file_id: mediaFile.file_id,
            file_unique_id: mediaFile.file_unique_id,
            file_type: mediaType,
            public_url: publicUrl,
            telegram_data: telegramData,
            message_id: messageRecord?.id,
            caption: message.caption,
            ...(productInfo && {
              product_name: productInfo.product_name,
              product_code: productInfo.product_code,
              quantity: productInfo.quantity,
              vendor_uid: productInfo.vendor_uid,
              purchase_date: productInfo.purchase_date,
              notes: productInfo.notes,
              analyzed_content: productInfo
            })
          })
          .select()
          .single();

        if (insertError) throw insertError;
        return newMedia;
      }

    } catch (error) {
      retryCount++;
      await handleProcessingError(supabase, error, messageRecord, retryCount);
      
      if (retryCount >= MAX_RETRY_ATTEMPTS) {
        throw error;
      }

      const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 10000);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }

  throw new Error(`Processing failed after ${MAX_RETRY_ATTEMPTS} attempts`);
}