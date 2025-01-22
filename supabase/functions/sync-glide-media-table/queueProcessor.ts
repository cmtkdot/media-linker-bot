import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { GlideSyncQueueItem, SyncResult } from './types.ts';
import { GlideAPI } from './glideApi.ts';
import { mapSupabaseToGlide, mapGlideToSupabase } from './productMapper.ts';

export class QueueProcessor {
  constructor(
    private supabase: ReturnType<typeof createClient>,
    private config: any,
    private glideApi: GlideAPI
  ) {}

  async processQueueItem(item: GlideSyncQueueItem, result: SyncResult) {
    console.log('Processing queue item:', { id: item.id, operation: item.operation });

    try {
      switch (item.operation) {
        case 'INSERT': {
          if (!item.new_data) {
            throw new Error('No new data provided for INSERT operation');
          }

          const mappedData = mapSupabaseToGlide(item.new_data);
          const response = await this.glideApi.addRow(mappedData);

          if (response.rowIDs?.[0]) {
            // Update the telegram_media record with the new row ID
            const { error: updateError } = await this.supabase
              .from(this.config.supabase_table_name)
              .update({ 
                telegram_media_row_id: response.rowIDs[0],
                last_synced_at: new Date().toISOString()
              })
              .eq('id', item.new_data.id);

            if (updateError) throw updateError;
            result.added++;
          }
          break;
        }

        case 'UPDATE': {
          if (!item.new_data?.telegram_media_row_id) {
            throw new Error('No Glide row ID found for UPDATE operation');
          }

          const mappedData = mapSupabaseToGlide(item.new_data);
          await this.glideApi.updateRow(item.new_data.telegram_media_row_id, mappedData);

          // Update last_synced_at in Supabase
          const { error: updateError } = await this.supabase
            .from(this.config.supabase_table_name)
            .update({ last_synced_at: new Date().toISOString() })
            .eq('id', item.new_data.id);

          if (updateError) throw updateError;
          result.updated++;
          break;
        }

        case 'DELETE': {
          if (!item.old_data?.telegram_media_row_id) {
            throw new Error('No Glide row ID found for DELETE operation');
          }

          await this.glideApi.deleteRow(item.old_data.telegram_media_row_id);
          result.deleted++;
          break;
        }

        default:
          throw new Error(`Unknown operation: ${item.operation}`);
      }

    } catch (error) {
      console.error('Error processing queue item:', {
        item_id: item.id,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
}