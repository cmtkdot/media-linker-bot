import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { GlideAPI } from './glideApi.ts';
import type { GlideSyncQueueItem, GlideConfig } from './types.ts';
import { mapSupabaseToGlide } from './productMapper.ts';

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;
const DB_TIMEOUT_ERROR = '57014';

export class QueueProcessor {
  constructor(
    private supabase: ReturnType<typeof createClient>,
    private config: GlideConfig,
    private glideApi: GlideAPI
  ) {}

  private async wait(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async withRetry<T>(
    operation: () => Promise<T>,
    retryCount = 0
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (retryCount >= MAX_RETRIES) {
        throw error;
      }

      const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
      await this.wait(delay);

      return this.withRetry(operation, retryCount + 1);
    }
  }

  async processQueueItem(item: GlideSyncQueueItem) {
    try {
      switch (item.operation) {
        case 'INSERT': {
          if (!item.new_data) {
            throw new Error('New data is required for INSERT operation');
          }

          const glideData = mapSupabaseToGlide(item.new_data);
          const glideResponse = await this.withRetry(
            async () => this.glideApi.addRow(glideData, item.record_id)
          );

          await this.supabase
            .from('telegram_media')
            .update({ telegram_media_row_id: glideResponse.rowID })
            .eq('id', item.record_id);

          break;
        }

        case 'UPDATE': {
          const { data: currentRecord } = await this.supabase
            .from('telegram_media')
            .select('telegram_media_row_id')
            .eq('id', item.record_id)
            .single();

          if (!currentRecord?.telegram_media_row_id) {
            throw new Error(`Record ${item.record_id} does not have a Glide row ID`);
          }

          if (!item.new_data) {
            throw new Error('New data is required for UPDATE operation');
          }

          const glideData = mapSupabaseToGlide(item.new_data);
          await this.withRetry(
            async () => this.glideApi.updateRow(currentRecord.telegram_media_row_id!, glideData)
          );
          break;
        }

        case 'DELETE': {
          if (!item.old_data?.telegram_media_row_id) {
            throw new Error('Glide row ID is required for DELETE operation');
          }

          await this.withRetry(
            async () => this.glideApi.deleteRow(item.old_data!.telegram_media_row_id!)
          );
          break;
        }

        default:
          throw new Error(`Unknown operation: ${item.operation}`);
      }

      await this.supabase
        .from('glide_sync_queue')
        .update({
          processed_at: new Date().toISOString(),
          error: null
        })
        .eq('id', item.id);

    } catch (error) {
      console.error('Error processing queue item:', {
        item_id: item.id,
        operation: item.operation,
        error: error.message,
        retry_count: item.retry_count || 0
      });

      await this.supabase
        .from('glide_sync_queue')
        .update({
          error: error.message,
          retry_count: (item.retry_count || 0) + 1
        })
        .eq('id', item.id);

      if ((item.retry_count || 0) >= MAX_RETRIES) {
        await this.supabase
          .from('glide_sync_queue')
          .update({
            processed_at: new Date().toISOString(),
            error: `Max retries (${MAX_RETRIES}) reached: ${error.message}`
          })
          .eq('id', item.id);
      }

      throw error;
    }
  }
}