import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAndDownloadTelegramFile } from './telegram-service.ts';
import { getMimeType } from './media-validators.ts';
import { downloadAndStoreThumbnail } from './thumbnail-handler.ts';
import { withDatabaseRetry } from './database-retry.ts';
import { handleMediaGroup } from './media-group-handler.ts';

export async function processMediaFiles(
  message: any,
  messageRecord: any,
  messageMediaData: any,
  supabase: any,
  botToken: string,
  correlationId = crypto.randomUUID()
) {
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

  console.log('Processing media files:', { 
    mediaFiles, 
    media_group_id: message.media_group_id,
    correlation_id: correlationId
  });

  for (const { type, file } of mediaFiles) {
    try {
      console.log(`Processing ${type} file:`, { 
        file_id: file.file_id,
        media_group_id: message.media_group_id,
        correlation_id: correlationId
      });

      const { data: existingMedia } = await withDatabaseRetry(
        async () => {
          return await supabase
            .from('telegram_media')
            .select('id, public_url, telegram_data')
            .eq('file_unique_id', file.file_unique_id)
            .maybeSingle();
        }
      );

      if (existingMedia) {
        console.log('Media already exists:', {
          id: existingMedia.id,
          correlation_id: correlationId
        });

        // Update existing record with new message data
        const { error: updateError } = await supabase
          .from('telegram_media')
          .update({ 
            message_id: messageRecord?.id,
            message_media_data: messageMediaData
          })
          .eq('id', existingMedia.id);

        if (updateError) {
          console.error('Error updating message_id:', updateError);
        }

        continue;
      }

      const { buffer, filePath } = await getAndDownloadTelegramFile(file.file_id, botToken);
      const fileExt = filePath.split('.').pop() || '';
      const fileName = `${file.file_unique_id}.${fileExt}`;

      // Handle video thumbnail
      let thumbnailState = 'pending';
      let thumbnailSource = null;
      let thumbnailUrl: string | null = null;
      let thumbnailError: string | null = null;

      if (type === 'video' && message.video?.thumb) {
        console.log('Processing video thumbnail:', {
          thumb_file_id: message.video.thumb.file_id,
          correlation_id: correlationId
        });
        
        try {
          thumbnailUrl = await downloadAndStoreThumbnail(
            message.video.thumb,
            botToken,
            supabase
          );
          
          if (thumbnailUrl) {
            thumbnailState = 'downloaded';
            thumbnailSource = 'telegram';
            console.log('Successfully processed thumbnail:', thumbnailUrl);
          }
        } catch (thumbError) {
          console.error('Error processing thumbnail:', thumbError);
          thumbnailState = 'failed';
          thumbnailError = thumbError.message;
        }
      }

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
              thumbnail_url: thumbnailUrl,
              thumbnail_state: thumbnailState,
              thumbnail_source: thumbnailSource,
              thumbnail_error: thumbnailError,
              telegram_data: {
                message_id: message.message_id,
                chat_id: message.chat.id,
                chat: message.chat,
                media_group_id: message.media_group_id,
                date: message.date,
                storage_path: fileName
              },
              message_media_data: messageMediaData
            }]);

          if (insertError) throw insertError;
        }
      );

      if (message.media_group_id) {
        console.log('Processing media group:', {
          media_group_id: message.media_group_id,
          correlation_id: correlationId
        });
        await handleMediaGroup(supabase, message, messageRecord);
      }
    } catch (error) {
      console.error('Error processing media file:', {
        error,
        correlation_id: correlationId
      });
      throw error;
    }
  }

  return { success: true };
}