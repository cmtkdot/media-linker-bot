import { SupabaseClient } from '@supabase/supabase-js';
import { GlideAPI } from './glideApi.ts';
import { GlideSyncQueueItem, GlideConfig, TelegramMedia } from '../_shared/types.ts';
import { mapSupabaseToGlide } from './productMapper.ts';

export class QueueProcessor {
  constructor(
    private supabase: SupabaseClient,
    private config: GlideConfig,
    private glideApi: GlideAPI
  ) {}

  async processQueueItem(item: GlideSyncQueueItem, result: { added: number; updated: number; deleted: number; errors: string[] }) {
    console.log('Processing queue item:', item);

    try {
      switch (item.operation) {
        case 'INSERT': {
          if (!item.new_data) {
            throw new Error('New data is required for INSERT operation');
          }

          // Map Supabase data to Glide format
          const glideData = mapSupabaseToGlide(item.new_data);
          
          // Add row to Glide and get rowID back
          await this.glideApi.addRow(glideData, item.record_id);
          result.added++;
          break;
        }

        case 'UPDATE': {
          if (!item.new_data || !item.old_data?.telegram_media_row_id) {
            throw new Error('New data and Glide row ID are required for UPDATE operation');
          }

          // Map updated data to Glide format
          const glideData = mapSupabaseToGlide(item.new_data);
          
          // Update existing row in Glide
          await this.glideApi.updateRow(item.old_data.telegram_media_row_id, glideData);
          result.updated++;
          break;
        }

        case 'DELETE': {
          if (!item.old_data?.telegram_media_row_id) {
            throw new Error('Glide row ID is required for DELETE operation');
          }

          // Delete row from Glide
          await this.glideApi.deleteRow(item.old_data.telegram_media_row_id);
          result.deleted++;
          break;
        }

        default:
          throw new Error(`Unknown operation: ${item.operation}`);
      }

      // Mark item as processed
      const { error: updateError } = await this.supabase
        .from('glide_sync_queue')
        .update({
          processed_at: new Date().toISOString(),
          error: null
        })
        .eq('id', item.id);

      if (updateError) {
        throw updateError;
      }

    } catch (error) {
      console.error('Error processing queue item:', error);
      result.errors.push(`Error processing item ${item.id}: ${error.message}`);

      // Update error information
      const { error: updateError } = await this.supabase
        .from('glide_sync_queue')
        .update({
          error: error.message,
          retry_count: (item.retry_count || 0) + 1
        })
        .eq('id', item.id);

      if (updateError) {
        console.error('Error updating queue item error status:', updateError);
      }
    }
  }
}