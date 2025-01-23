import { getAndDownloadTelegramFile } from './telegram-service.ts';
import { getMimeType } from './media-validators.ts';
import { downloadAndStoreThumbnail } from './thumbnail-handler.ts';
import { withDatabaseRetry } from './database-retry.ts';
import { SyncErrorType } from './sync-logger.ts';
import { handleMediaGroup } from './media-group-handler.ts';
import { SupabaseClient } from '@supabase/supabase-js';

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

interface MediaFile {
  type: 'photo' | 'video' | 'document' | 'animation';
  file: {
    file_id: string;
    file_unique_id: string;
    thumb?: {
      file_id: string;
    };
  };
}

function getMessageUrl(message: TelegramMessage): string | null {
  if (!message.chat?.username || message.chat.type !== 'channel') {
    return null;
  }
  return `https://t.me/${message.chat.username}/${message.message_id}`;
}

export async function processMediaFiles(
  message: TelegramMessage,
  messageRecord: MessageRecord,
  supabase: SupabaseClient,
  botToken: string,
  correlationId = crypto.randomUUID()
) {
  // First handle media group if present
  if (message.media_group_id) {
    const mediaGroup = await handleMediaGroup(supabase, message, messageRecord);
    console.log('Processed media group:', mediaGroup?.media_group_id);
  }

  const mediaFiles: MediaFile[] = [];
  if (message.photo) {
    mediaFiles.push({
      type: 'photo',
      file: message.photo[message.photo.length - 1]
    });
  }
  if (message.video) mediaFiles.push({ type: 'video', file: message.video });
  if (message.document) mediaFiles.push({ type: 'document', file: message.document });
  if (message.animation) mediaFiles.push({ type: 'animation', file: message.animation });

  const messageUrl = getMessageUrl(message);

  for (const { type, file } of mediaFiles) {
    const { data: existingMedia } = await withDatabaseRetry(
      async () => {
        return await supabase
          .from('telegram_media')
          .select('id, public_url, telegram_data')
          .eq('file_unique_id', file.file_unique_id)
          .maybeSingle();
      }
    );

    // If media exists and is part of a group, update group info
    if (existingMedia && message.media_group_id) {
      await withDatabaseRetry(
        async () => {
          const { error: updateError } = await supabase
            .from('telegram_media')
            .update({
              telegram_data: {
                ...existingMedia.telegram_data,
                media_group_id: message.media_group_id
              },
              message_url: messageUrl
            })
            .eq('id', existingMedia.id);

          if (updateError) throw updateError;
        }
      );
      continue;
    }

    if (existingMedia) continue;

    const { buffer, filePath } = await getAndDownloadTelegramFile(file.file_id, botToken);
    const fileExt = filePath.split('.').pop() || '';
    const fileName = `${file.file_unique_id}.${fileExt}`;

    // Handle video thumbnail if available
    let thumbnailUrl: string | null = null;
    if (type === 'video' && file.thumb) {
      const thumbData = await getAndDownloadTelegramFile(file.thumb.file_id, botToken);
      const thumbFileName = `thumb_${file.file_unique_id}.jpg`;
      
      await withDatabaseRetry(
        async () => {
          const { error: thumbError } = await supabase.storage
            .from('thumbnails')
            .upload(thumbFileName, thumbData.buffer, {
              contentType: 'image/jpeg',
              upsert: true,
              cacheControl: '3600'
            });

          if (thumbError) throw thumbError;
        }
      );

      const { data: { publicUrl: thumbUrl } } = await supabase.storage
        .from('thumbnails')
        .getPublicUrl(thumbFileName);

      thumbnailUrl = thumbUrl;
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
            caption: message.caption,
            message_url: messageUrl,
            telegram_data: {
              message_id: message.message_id,
              chat_id: message.chat.id,
              chat: {
                username: message.chat.username,
                type: message.chat.type
              },
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
}