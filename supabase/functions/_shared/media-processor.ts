import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAndDownloadTelegramFile } from './telegram-service.ts';
import { getMimeType } from './media-validators.ts';
import { downloadAndStoreThumbnail } from './thumbnail-handler.ts';
import { withDatabaseRetry } from './database-retry.ts';
import { handleMediaGroup } from './media-group-handler.ts';
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface TelegramMessage {
  photo?: Array<{
    file_id: string;
    file_unique_id: string;
  }>;
  video?: {
    file_id: string;
    file_unique_id: string;
    thumb?: {
      file_id: string;
    };
  };
  document?: {
    file_id: string;
    file_unique_id: string;
  };
  animation?: {
    file_id: string;
    file_unique_id: string;
  };
  message_id: number;
  chat: {
    id: number;
    username?: string;
    type: string;
  };
  media_group_id?: string;
  caption?: string;
  date: number;
}

interface MessageRecord {
  id: string;
  message_id: number;
  chat_id: number;
  caption?: string;
  media_group_id?: string;
  processed_at?: string;
}

export async function processMediaFiles(
  message: TelegramMessage,
  messageRecord: MessageRecord,
  supabase: SupabaseClient,
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
    media_group_id: message.media_group_id 
  });

  for (const { type, file } of mediaFiles) {
    try {
      console.log(`Processing ${type} file:`, { 
        file_id: file.file_id,
        media_group_id: message.media_group_id
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
          id: existingMedia.id
        });
        continue;
      }

      const { buffer, filePath } = await getAndDownloadTelegramFile(file.file_id, botToken);
      const fileExt = filePath.split('.').pop() || '';
      const fileName = `${file.file_unique_id}.${fileExt}`;

      // Handle video thumbnail
      let thumbnailUrl: string | null = null;
      if (type === 'video' && message.video?.thumb) {
        console.log('Processing video thumbnail:', {
          thumb_file_id: message.video.thumb.file_id
        });
        
        try {
          thumbnailUrl = await downloadAndStoreThumbnail(
            message.video.thumb,
            botToken,
            supabase
          );
          
          if (thumbnailUrl) {
            console.log('Successfully processed video thumbnail:', thumbnailUrl);
          }
        } catch (thumbError) {
          console.error('Error processing video thumbnail:', thumbError);
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

      // Create media record with telegram_data containing media_group_id
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
              caption: message.caption,
              telegram_data: {
                message_id: message.message_id,
                chat_id: message.chat.id,
                chat: message.chat,
                media_group_id: message.media_group_id,
                date: message.date,
                storage_path: fileName
              }
            }]);

          if (insertError) throw insertError;
        }
      );

      // If this is part of a media group, handle group syncing
      if (message.media_group_id) {
        console.log('Processing media group:', message.media_group_id);
        await handleMediaGroup(supabase, message, messageRecord);
      }
    } catch (error) {
      console.error('Error processing media file:', error);
      throw error;
    }
  }

  return { success: true };
}