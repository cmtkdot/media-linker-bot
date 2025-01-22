import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { GlideAPI } from './glideApi.ts';
import type { GlideSyncQueueItem, GlideConfig, TelegramMedia } from '../_shared/types.ts';
import { mapSupabaseToGlide } from './productMapper.ts';

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

export class QueueProcessor {
  private supabase;

  constructor(
    private config: GlideConfig,
    private glideApi: GlideAPI
  ) {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    // Ensure URL has https:// prefix
    const formattedUrl = supabaseUrl.startsWith('http') ? supabaseUrl : `https://${supabaseUrl}`;
    
    this.supabase = createClient(formattedUrl, supabaseKey, {
      auth: {
        persistSession: false
      }
    });
  }

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
      console.log(`Retry ${retryCount + 1}/${MAX_RETRIES} after ${delay}ms`);
      await this.wait(delay);

      return this.withRetry(operation, retryCount + 1);
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

          const glideData = mapSupabaseToGlide(item.new_data as TelegramMedia);
          
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

          const glideData = mapSupabaseToGlide(item.new_data as TelegramMedia);
          
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

          await this.withRetry(async () => {
            await this.glideApi.deleteRow(item.old_data!.telegram_media_row_id!);
          });
          result.deleted++;
          break;
        }

        default:
          throw new Error(`Unknown operation: ${item.operation}`);
      }

      await this.updateQueueItemStatus(item, {
        processed_at: new Date().toISOString(),
        error: null
      });

    } catch (error) {
      console.error('Error processing queue item:', error);
      result.errors.push(`Error processing item ${item.id}: ${error.message}`);

      await this.updateQueueItemStatus(item, {
        error: error.message,
        retry_count: (item.retry_count || 0) + 1
      });

      if ((item.retry_count || 0) >= MAX_RETRIES) {
        await this.updateQueueItemStatus(item, {
          processed_at: new Date().toISOString(),
          error: `Max retries (${MAX_RETRIES}) reached: ${error.message}`
        });
      }
    }
  }
}