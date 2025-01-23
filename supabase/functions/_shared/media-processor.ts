import { getAndDownloadTelegramFile } from './telegram-service.ts';
import { getMimeType } from './media-validators.ts';
import { downloadAndStoreThumbnail } from './thumbnail-handler.ts';
import { withDatabaseRetry } from './database-retry.ts';
import { SyncErrorType } from './sync-logger.ts';

export async function processMediaFiles(
  message: any,
  messageRecord: any,
  supabase: any,
  botToken: string,
  correlationId = crypto.randomUUID()
) {
  try {
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

    for (const { type, file } of mediaFiles) {
      const { data: existingMedia } = await withDatabaseRetry(
        async () => {
          return await supabase
            .from('telegram_media')
            .select('id, public_url')
            .eq('file_unique_id', file.file_unique_id)
            .maybeSingle();
        }
      );

      if (existingMedia) continue;

      const { buffer, filePath } = await getAndDownloadTelegramFile(file.file_id, botToken);
      const fileExt = filePath.split('.').pop() || '';
      const fileName = `${file.file_unique_id}.${fileExt}`;

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
        }
      );

      const { data: { publicUrl } } = await supabase.storage
        .from('media')
        .getPublicUrl(fileName);

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
        }
      );
    }

    return { success: true };
  } catch (error) {
    throw error;
  }
}