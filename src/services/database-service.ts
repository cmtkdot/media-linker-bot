import { supabase } from "@/integrations/supabase/client";
import { MediaItem, MessageMediaData } from "@/types/media";
import { withDatabaseRetry } from "@/utils/database-retry";

const convertToMediaItem = (data: any): MediaItem => {
  const messageMediaData = data.message_media_data as MessageMediaData;
  return {
    ...data,
    message_media_data: messageMediaData,
    media_group_id: data.telegram_data?.media_group_id
  };
};

export class DatabaseService {
  async getMediaItem(id: string): Promise<MediaItem | null> {
    return withDatabaseRetry(async () => {
      const { data, error } = await supabase
        .from('telegram_media')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data ? convertToMediaItem(data) : null;
    });
  }

  async getMediaItems(): Promise<MediaItem[]> {
    return withDatabaseRetry(async () => {
      const { data, error } = await supabase
        .from('telegram_media')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data?.map(convertToMediaItem) || [];
    });
  }

  async updateMediaItem(id: string, updates: Partial<MediaItem>): Promise<void> {
    const { message_media_data, telegram_data, ...rest } = updates;
    return withDatabaseRetry(async () => {
      const { error } = await supabase
        .from('telegram_media')
        .update({
          ...rest,
          message_media_data: message_media_data ? JSON.parse(JSON.stringify(message_media_data)) : undefined,
          telegram_data: telegram_data ? JSON.parse(JSON.stringify(telegram_data)) : undefined,
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
}

export const databaseService = new DatabaseService();