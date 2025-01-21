import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { GlideSyncQueueItem, SyncResult } from './types.ts';
import { GlideAPI } from './glideApi.ts';

export class QueueProcessor {
  constructor(
    private supabase: ReturnType<typeof createClient>,
    private config: any,
    private glideApi: GlideAPI
  ) {}

  async processQueueItem(item: GlideSyncQueueItem, result: SyncResult) {
    try {
      switch (item.operation) {
        case 'INSERT': {
          const response = await this.glideApi.addRow(item.new_data);
          if (response.rowIDs?.[0]) {
            await this.updateTelegramMediaRowId(item.new_data.id, response.rowIDs[0]);
            result.added++;
          }
          break;
        }
        case 'UPDATE': {
          if (item.new_data?.telegram_media_row_id) {
            await this.glideApi.updateRow(item.new_data.telegram_media_row_id, item.new_data);
            result.updated++;
          }
          break;
        }
        case 'DELETE': {
          if (item.old_data?.telegram_media_row_id) {
            await this.glideApi.deleteRow(item.old_data.telegram_media_row_id);
            result.deleted++;
          }
          break;
        }
      }

      await this.markItemAsProcessed(item.id);
    } catch (error) {
      console.error('Error processing queue item:', {
        item_id: item.id,
        error: error.message,
        stack: error.stack
      });

      await this.updateItemError(item.id, error.message);
      result.errors.push(`Error processing ${item.id}: ${error.message}`);
    }
  }

  private async updateTelegramMediaRowId(recordId: string, glideRowId: string) {
    const { error } = await this.supabase
      .from(this.config.supabase_table_name)
      .update({ 
        telegram_media_row_id: glideRowId,
        last_synced_at: new Date().toISOString()
      })
      .eq('id', recordId);

    if (error) throw error;

    console.log('Updated telegram_media_row_id:', {
      record_id: recordId,
      glide_row_id: glideRowId
    });
  }

  private async markItemAsProcessed(itemId: string) {
    const { error } = await this.supabase
      .from('glide_sync_queue')
      .update({
        processed_at: new Date().toISOString(),
        error: null
      })
      .eq('id', itemId);

    if (error) throw error;
  }

  private async updateItemError(itemId: string, errorMessage: string) {
    const { error } = await this.supabase
      .from('glide_sync_queue')
      .update({
        error: errorMessage,
        retry_count: this.supabase.sql`retry_count + 1`
      })
      .eq('id', itemId);

    if (error) {
      console.error('Error updating queue item error status:', error);
    }
  }
}