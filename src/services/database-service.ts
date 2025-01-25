import { supabase } from "@/integrations/supabase/client";
import { MediaItem, MessageMediaData } from "@/types/media";
import { TelegramMessage } from "@/types/telegram-types";
import { withDatabaseRetry } from "@/utils/database-retry";

export class DatabaseService {
  async getMediaItem(id: string): Promise<MediaItem | null> {
    return withDatabaseRetry(async () => {
      const { data, error } = await supabase
        .from('telegram_media')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      
      const item = data as any;
      const messageMediaData: MessageMediaData = {
        message: {
          url: item.message_url || '',
          media_group_id: item.telegram_data?.media_group_id || '',
          caption: item.telegram_data?.caption || '',
          message_id: item.telegram_data?.message_id || 0,
          chat_id: item.telegram_data?.chat?.id || 0,
          date: item.telegram_data?.date || 0
        },
        sender: {
          sender_info: item.telegram_data?.from || item.telegram_data?.sender_chat || {},
          chat_info: item.telegram_data?.chat || {}
        },
        analysis: {
          analyzed_content: item.analyzed_content || {}
        },
        meta: {
          created_at: item.created_at,
          updated_at: item.updated_at,
          status: item.processing_error ? 'error' : item.processed ? 'processed' : 'pending',
          error: item.processing_error
        },
        media: {
          file_id: item.file_id,
          file_unique_id: item.file_unique_id,
          file_type: item.file_type,
          public_url: item.public_url,
          storage_path: item.storage_path
        },
        glide: {
          row_id: item.telegram_media_row_id,
          app_url: item.glide_app_url,
          sync_status: item.glide_sync_status,
          last_sync: item.glide_last_sync
        }
      };

      return {
        ...item,
        telegram_data: item.telegram_data as TelegramMessage,
        message_media_data: messageMediaData
      } as MediaItem;
    });
  }

  async getMediaItems(): Promise<MediaItem[]> {
    return withDatabaseRetry(async () => {
      const { data, error } = await supabase
        .from('telegram_media')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data.map((item: any) => {
        const messageMediaData: MessageMediaData = {
          message: {
            url: item.message_url || '',
            media_group_id: item.telegram_data?.media_group_id || '',
            caption: item.telegram_data?.caption || '',
            message_id: item.telegram_data?.message_id || 0,
            chat_id: item.telegram_data?.chat?.id || 0,
            date: item.telegram_data?.date || 0
          },
          sender: {
            sender_info: item.telegram_data?.from || item.telegram_data?.sender_chat || {},
            chat_info: item.telegram_data?.chat || {}
          },
          analysis: {
            analyzed_content: item.analyzed_content || {}
          },
          meta: {
            created_at: item.created_at,
            updated_at: item.updated_at,
            status: item.processing_error ? 'error' : item.processed ? 'processed' : 'pending',
            error: item.processing_error
          },
          media: {
            file_id: item.file_id,
            file_unique_id: item.file_unique_id,
            file_type: item.file_type,
            public_url: item.public_url,
            storage_path: item.storage_path
          },
          glide: {
            row_id: item.telegram_media_row_id,
            app_url: item.glide_app_url,
            sync_status: item.glide_sync_status,
            last_sync: item.glide_last_sync
          }
        };

        return {
          ...item,
          telegram_data: item.telegram_data as TelegramMessage,
          message_media_data: messageMediaData
        } as MediaItem;
      });
    });
  }

  async updateMediaItem(id: string, updates: Partial<MediaItem>): Promise<void> {
    const { message_media_data, telegram_data, glide_data, media_metadata, ...rest } = updates;
    return withDatabaseRetry(async () => {
      const { error } = await supabase
        .from('telegram_media')
        .update({
          ...rest,
          message_media_data: message_media_data ? JSON.parse(JSON.stringify(message_media_data)) : undefined,
          telegram_data: telegram_data ? JSON.parse(JSON.stringify(telegram_data)) : undefined,
          glide_data: glide_data ? JSON.parse(JSON.stringify(glide_data)) : undefined,
          media_metadata: media_metadata ? JSON.parse(JSON.stringify(media_metadata)) : undefined
        })
        .eq('id', id);
      if (error) throw error;
    });
  }

  async deleteMediaItem(id: string): Promise<void> {
    return withDatabaseRetry(async () => {
      const { error } = await supabase
        .from('telegram_media')
        .delete()
        .eq('id', id);
      if (error) throw error;
    });
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    return Array.from({ length: Math.ceil(array.length / size) }, (_, i) =>
      array.slice(i * size, i * size + size)
    );
  }
}

export const databaseService = new DatabaseService();
