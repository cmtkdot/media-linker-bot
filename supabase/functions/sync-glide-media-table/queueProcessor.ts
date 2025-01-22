import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { GlideAPI } from './glideApi.ts';
import type { GlideSyncQueueItem, GlideConfig } from './types.ts';
import { mapSupabaseToGlide } from './productMapper.ts';
import { SyncErrorType } from '../_shared/sync-logger.ts';

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

export class QueueProcessor {
  constructor(
    private supabase: ReturnType<typeof createClient>,
    private config: GlideConfig,
    private glideApi: GlideAPI,
    private logger: any
  ) {}

  private async wait(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async withRetry<T>(
    operation: () => Promise<T>,
    retryCount = 0,
    context: { operation: string; itemId: string }
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      this.logger.log({
        operation: context.operation,
        status: 'error',
        errorType: error.name === 'GlideApiError' ? SyncErrorType.API : SyncErrorType.UNKNOWN,
        details: {
          retry_count: retryCount,
          item_id: context.itemId,
          error: error.message
        }
      });

      if (retryCount >= MAX_RETRIES) {
        throw error;
      }

      const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
      await this.wait(delay);

      return this.withRetry(operation, retryCount + 1, context);
    }
  }

  private async updateQueueItemStatus(
    item: GlideSyncQueueItem,
    status: {
      processed_at?: string;
      error?: string | null;
      retry_count?: number;
    }
  ) {
    const { error: updateError } = await this.supabase
      .from('glide_sync_queue')
      .update(status)
      .eq('id', item.id);

    if (updateError) {
      console.error('Error updating queue item status:', updateError);
      throw updateError;
    }
  }

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
          
          // Add row to Glide with retry logic
          await this.withRetry(async () => {
            await this.glideApi.addRow(glideData, item.record_id);
          });
          result.added++;
          break;
        }

        case 'UPDATE': {
          if (!item.new_data || !item.old_data?.telegram_media_row_id) {
            throw new Error('New data and Glide row ID are required for UPDATE operation');
          }

          // Map updated data to Glide format
          const glideData = mapSupabaseToGlide(item.new_data);
          
          // Update existing row in Glide with retry logic
          await this.withRetry(async () => {
            await this.glideApi.updateRow(item.old_data!.telegram_media_row_id!, glideData);
          });
          result.updated++;
          break;
        }

        case 'DELETE': {
          if (!item.old_data?.telegram_media_row_id) {
            throw new Error('Glide row ID is required for DELETE operation');
          }

          // Delete row from Glide with retry logic
          await this.withRetry(async () => {
            await this.glideApi.deleteRow(item.old_data!.telegram_media_row_id!);
          });
          result.deleted++;
          break;
        }

        default:
          throw new Error(`Unknown operation: ${item.operation}`);
      }

      // Mark item as processed
      await this.updateQueueItemStatus(item, {
        processed_at: new Date().toISOString(),
        error: null
      });

    } catch (error) {
      console.error('Error processing queue item:', error);
      result.errors.push(`Error processing item ${item.id}: ${error.message}`);

      // Update error information
      await this.updateQueueItemStatus(item, {
        error: error.message,
        retry_count: (item.retry_count || 0) + 1
      });

      // If max retries reached, mark as processed to prevent further attempts
      if ((item.retry_count || 0) >= MAX_RETRIES) {
        await this.updateQueueItemStatus(item, {
          processed_at: new Date().toISOString(),
          error: `Max retries (${MAX_RETRIES}) reached: ${error.message}`
        });
      }
    }
  }
}
