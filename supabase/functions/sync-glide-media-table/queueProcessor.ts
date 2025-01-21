import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { createGlideRecord, updateGlideRecord, deleteGlideRecord } from './glideApi.ts';
import { mapSupabaseToGlide } from './productMapper.ts';
import type { SyncResult } from './types.ts';

export async function processQueueItems(
  supabase: ReturnType<typeof createClient>,
  config: any,
  result: SyncResult
) {
  console.log('Processing pending sync queue items...');

  const { data: queueItems, error: queueError } = await supabase
    .from('glide_sync_queue')
    .select('*')
    .is('processed_at', null)
    .eq('table_name', config.supabase_table_name)
    .order('created_at', { ascending: true });

  if (queueError) throw queueError;

  console.log(`Found ${queueItems?.length || 0} pending sync items`);

  for (const item of queueItems || []) {
    try {
      switch (item.operation) {
        case 'INSERT': {
          const recordData = item.new_data;
          if (!recordData) continue;

          const glideData = mapSupabaseToGlide(recordData);
          await createGlideRecord(config.app_id, config.table_id, glideData);
          result.added++;
          break;
        }

        case 'UPDATE': {
          const recordData = item.new_data;
          if (!recordData) continue;

          const glideData = mapSupabaseToGlide(recordData);
          const glideId = recordData.telegram_media_row_id;
          
          if (glideId) {
            await updateGlideRecord(config.app_id, config.table_id, glideId, glideData);
            result.updated++;
          }
          break;
        }

        case 'DELETE': {
          const recordData = item.old_data;
          if (!recordData?.telegram_media_row_id) continue;

          await deleteGlideRecord(
            config.app_id,
            config.table_id,
            recordData.telegram_media_row_id
          );
          result.deleted++;
          break;
        }
      }

      // Mark queue item as processed
      await supabase
        .from('glide_sync_queue')
        .update({
          processed_at: new Date().toISOString(),
          error: null
        })
        .eq('id', item.id);

    } catch (error) {
      console.error('Error processing queue item:', {
        item_id: item.id,
        error: error.message,
        stack: error.stack
      });

      // Update queue item with error
      await supabase
        .from('glide_sync_queue')
        .update({
          error: error.message,
          retry_count: (item.retry_count || 0) + 1
        })
        .eq('id', item.id);

      result.errors.push(`Error processing ${item.id}: ${error.message}`);
    }
  }

  return result;
}