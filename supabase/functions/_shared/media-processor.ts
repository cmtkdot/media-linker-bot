import { getAndDownloadTelegramFile } from './telegram-service.ts';
import { getMimeType } from './media-validators.ts';
import { downloadAndStoreThumbnail } from './thumbnail-handler.ts';
import { withDatabaseRetry } from './database-retry.ts';

export async function processMediaFiles(
  message: any,
  messageRecord: any,
  supabase: any,
  botToken: string
) {
  console.log('Processing media files for message:', {
    message_id: message.message_id,
    media_group_id: message.media_group_id,
    has_caption: !!message.caption,
    has_analyzed_content: !!messageRecord.analyzed_content
  });

  try {
    // Determine media files to process
    const mediaFiles = [];
    if (message.photo) {
      mediaFiles.push({
        type: 'photo',
        file: message.photo[message.photo.length - 1]
      });
    }
    if (message.video) mediaFiles.push({ type: 'video', file: message.video });
    if (message.document) mediaFiles.push({ type: 'document', file: message.document });
    if (message.animation) mediaFiles.push({ type: 'animation', file: message.animation });

    // Process each media file
    for (const { type, file } of mediaFiles) {
      // Handle video thumbnail
      let thumbnailUrl = null;
      if (type === 'video' && message.video?.thumb) {
        thumbnailUrl = await downloadAndStoreThumbnail(
          message.video.thumb,
          botToken,
          supabase
        );
      }

      // Download and process file
      const { buffer, filePath } = await getAndDownloadTelegramFile(file.file_id, botToken);
      const fileExt = filePath.split('.').pop() || '';
      const fileName = `${file.file_unique_id}.${fileExt}`;

      // Check for existing file
      const { data: existingFile } = await supabase.storage
        .from('media')
        .list('', {
          search: fileName
        });

      if (!existingFile || existingFile.length === 0) {
        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(fileName, buffer, {
            contentType: getMimeType(type, filePath),
            upsert: false,
            cacheControl: '3600'
          });

        if (uploadError) throw uploadError;
      }

      const { data: { publicUrl } } = await supabase.storage
        .from('media')
        .getPublicUrl(fileName);

      // Create or update media record
      const mediaRecord = {
        file_id: file.file_id,
        file_unique_id: file.file_unique_id,
        file_type: type,
        message_id: messageRecord.id,
        caption: messageRecord.caption,
        product_name: messageRecord.product_name,
        product_code: messageRecord.product_code,
        quantity: messageRecord.quantity,
        vendor_uid: messageRecord.vendor_uid,
        purchase_date: messageRecord.purchase_date,
        notes: messageRecord.notes,
        analyzed_content: messageRecord.analyzed_content,
        thumbnail_url: thumbnailUrl,
        public_url: publicUrl,
        message_url: messageRecord.message_url,
        telegram_data: {
          message_id: message.message_id,
          chat_id: message.chat.id,
          media_group_id: message.media_group_id,
          date: message.date,
          caption: message.caption,
          storage_path: fileName
        }
      };

      await withDatabaseRetry(async () => {
        const { error } = await supabase
          .from('telegram_media')
          .insert([mediaRecord]);

        if (error) throw error;
      });

      console.log('Successfully processed media file:', {
        type,
        file_id: file.file_id,
        public_url: publicUrl,
        thumbnail_url: thumbnailUrl
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Error processing media files:', error);
    throw error;
  }
}