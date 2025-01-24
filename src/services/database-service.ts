import { supabase } from "@/integrations/supabase/client";
import { MediaItem } from "@/types/media";
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
      return data as MediaItem;
    });
  }

  async getMediaItems(): Promise<MediaItem[]> {
    return withDatabaseRetry(async () => {
      const { data, error } = await supabase
        .from('telegram_media')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as MediaItem[];
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
