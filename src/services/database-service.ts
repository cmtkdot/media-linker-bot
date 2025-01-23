import { supabase } from "@/integrations/supabase/client";
import { withDatabaseRetry } from "@/utils/database-retry";
import type { MediaItem } from "@/types/media";

interface TransactionContext {
  insertMessage: (messageData: any) => Promise<any>;
  insertMedia: (messageId: string, mediaData: any) => Promise<any>;
  updateMediaGroup: (groupId: string, data: any) => Promise<any>;
}

class DatabaseService {
  async runTransaction<T>(
    callback: (tx: TransactionContext) => Promise<T>
  ): Promise<T> {
    const transactionContext: TransactionContext = {
      insertMessage: async (messageData) => {
        const { data, error } = await supabase
          .from('messages')
          .insert(messageData)
          .select()
          .single();
        if (error) throw error;
        return data;
      },
      insertMedia: async (messageId, mediaData) => {
        const { data, error } = await supabase
          .from('telegram_media')
          .insert({ ...mediaData, message_id: messageId })
          .select()
          .single();
        if (error) throw error;
        return data;
      },
      updateMediaGroup: async (groupId, data) => {
        const { error } = await supabase
          .from('media_groups')
          .update(data)
          .eq('media_group_id', groupId);
        if (error) throw error;
      }
    };

    return callback(transactionContext);
  }

  async updateMediaItem(id: string, updates: Partial<MediaItem>): Promise<void> {
    return withDatabaseRetry(async () => {
      const { error } = await supabase
        .from('telegram_media')
        .update(updates)
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

  async batchUpdateMedia(updates: Array<{ id: string; data: Partial<MediaItem> }>): Promise<void> {
    return withDatabaseRetry(async () => {
      for (const batch of this.chunkArray(updates, 10)) {
        await Promise.all(
          batch.map(({ id, data }) =>
            supabase
              .from('telegram_media')
              .update(data)
              .eq('id', id)
          )
        );
      }
    });
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    return Array.from({ length: Math.ceil(array.length / size) }, (_, i) =>
      array.slice(i * size, i * size + size)
    );
  }
}

export const databaseService = new DatabaseService();