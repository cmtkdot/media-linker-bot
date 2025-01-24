import { supabase } from "@/integrations/supabase/client";
import { withDatabaseRetry } from "@/utils/database-retry";
import type { MediaItem } from "@/types/media";

interface TransactionContext {
  insertMessage: (messageData: any) => Promise<any>;
  insertMedia: (messageId: string, mediaData: any) => Promise<any>;
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
      }
    };

    return callback(transactionContext);
  }

  async updateMediaItem(id: string, updates: Partial<MediaItem>): Promise<void> {
    const { message_media_data, ...rest } = updates;
    return withDatabaseRetry(async () => {
      const { error } = await supabase
        .from('telegram_media')
        .update({
          ...rest,
          message_media_data: message_media_data ? JSON.parse(JSON.stringify(message_media_data)) : undefined
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