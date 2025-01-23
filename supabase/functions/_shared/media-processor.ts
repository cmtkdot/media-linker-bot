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
  console.log('Starting media processing:', {
    message_id: message.message_id,
    media_group_id: message.media_group_id,
    has_caption: !!message.caption
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

    console.log('Found media files:', mediaFiles.length);

    // Process each media file with database retry
    for (const { type, file } of mediaFiles) {
      console.log(`Processing ${type} file:`, {
        file_id: file.file_id,
        message_id: messageRecord?.id
      });

      // Check for existing media first using retry
      const { data: existingMedia } = await withDatabaseRetry(
        async () => {
          return await supabase
            .from('telegram_media')
            .select('id, public_url')
            .eq('file_unique_id', file.file_unique_id)
            .maybeSingle();
        },
        0,
        `check_existing_media_${file.file_unique_id}`
      );

      if (existingMedia) {
        console.log('Media already exists:', existingMedia);
        continue;
      }

      // Download and process file
      const { buffer, filePath } = await getAndDownloadTelegramFile(file.file_id, botToken);
      const fileExt = filePath.split('.').pop() || '';
      const fileName = `${file.file_unique_id}.${fileExt}`;

      console.log('Uploading file to storage:', {
        fileName,
        fileType: type,
        mimeType: getMimeType(filePath, 'application/octet-stream')
      });

      // Upload to storage with retry
      await withDatabaseRetry(
        async () => {
          const { error: uploadError } = await supabase.storage
            .from('media')
            .upload(fileName, buffer, {
              contentType: getMimeType(filePath, 'application/octet-stream'),
              upsert: true,
              cacheControl: '3600'
            });

          if (uploadError) throw uploadError;
        },
        0,
        `upload_file_${fileName}`
      );

      const { data: { publicUrl } } = await supabase.storage
        .from('media')
        .getPublicUrl(fileName);

      // Create media record with retry
      await withDatabaseRetry(
        async () => {
          const { error: insertError } = await supabase
            .from('telegram_media')
            .insert([{
              file_id: file.file_id,
              file_unique_id: file.file_unique_id,
              file_type: type,
              message_id: messageRecord.id,
              public_url: publicUrl,
              caption: message.caption,
              telegram_data: {
                message_id: message.message_id,
                chat_id: message.chat.id,
                media_group_id: message.media_group_id,
                date: message.date,
                storage_path: fileName
              }
            }]);

          if (insertError) throw insertError;
        },
        0,
        `create_media_record_${file.file_unique_id}`
      );

      console.log('Successfully processed media file:', {
        file_id: file.file_id,
        type,
        public_url: publicUrl
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Error processing media files:', {
      error: error.message,
      stack: error.stack,
      message_id: message?.message_id
    });
    throw error;
  }
}