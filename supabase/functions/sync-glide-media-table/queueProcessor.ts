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
          
          // Add row to Glide with retry logic and get the row ID
          const glideResponse = await this.withRetry(
            async () => {
              return await this.glideApi.addRow(glideData, item.record_id);
            },
            0,
            { operation: 'insert', itemId: item.id }
          );

          // Update telegram_media with the Glide row ID
          const { error: updateError } = await this.supabase
            .from('telegram_media')
            .update({ telegram_media_row_id: glideResponse.rowID })
            .eq('id', item.record_id);

          if (updateError) {
            throw new Error(`Failed to update telegram_media_row_id: ${updateError.message}`);
          }

          result.added++;
          break;
        }

        case 'UPDATE': {
          // Get the current record from telegram_media to ensure we have the telegram_media_row_id
          const { data: currentRecord, error: fetchError } = await this.supabase
            .from('telegram_media')
            .select('telegram_media_row_id')
            .eq('id', item.record_id)
            .single();

          if (fetchError) {
            throw new Error(`Failed to fetch current record: ${fetchError.message}`);
          }

          if (!currentRecord?.telegram_media_row_id) {
            throw new Error(`Record ${item.record_id} does not have a Glide row ID`);
          }

          if (!item.new_data) {
            throw new Error('New data is required for UPDATE operation');
          }

          // Map updated data to Glide format
          const glideData = mapSupabaseToGlide(item.new_data);
          
          // Update existing row in Glide with retry logic
          await this.withRetry(
            async () => {
              await this.glideApi.updateRow(currentRecord.telegram_media_row_id!, glideData);
            },
            0,
            { operation: 'update', itemId: item.id }
          );
          result.updated++;
          break;
        }

        case 'DELETE': {
          if (!item.old_data?.telegram_media_row_id) {
            throw new Error('Glide row ID is required for DELETE operation');
          }

          // Delete row from Glide with retry logic
          await this.withRetry(
            async () => {
              await this.glideApi.deleteRow(item.old_data!.telegram_media_row_id!);
            },
            0,
            { operation: 'delete', itemId: item.id }
          );
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

      // Record performance metrics
      await this.supabase
        .from('sync_performance_metrics')
        .insert({
          operation_type: item.operation,
          start_time: item.created_at!,
          end_time: new Date().toISOString(),
          records_processed: 1,
          success_count: 1,
          error_count: 0,
          correlation_id: item.id,
          metadata: {
            table_name: item.table_name,
            record_id: item.record_id,
            batch_id: item.batch_id
          }
        });

    } catch (error) {
      console.error('Error processing queue item:', error);
      result.errors.push(`Error processing item ${item.id}: ${error.message}`);

      // Update error information
      await this.updateQueueItemStatus(item, {
        error: error.message,
        retry_count: (item.retry_count || 0) + 1
      });

      // Record performance metrics for failed operation
      await this.supabase
        .from('sync_performance_metrics')
        .insert({
          operation_type: item.operation,
          start_time: item.created_at!,
          end_time: new Date().toISOString(),
          records_processed: 1,
          success_count: 0,
          error_count: 1,
          correlation_id: item.id,
          metadata: {
            table_name: item.table_name,
            record_id: item.record_id,
            batch_id: item.batch_id,
            error: error.message
          }
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