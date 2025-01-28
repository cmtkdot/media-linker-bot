import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { processMediaItem } from '../media/media-processor.service';

export async function processQueue(supabase: any, items: any[]) {
  console.log(`Processing ${items.length} queue items`);

  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!botToken) throw new Error('Bot token not configured');

  for (const item of items) {
    try {
      console.log(`Processing queue item ${item.id}`);
      
      if (!item.message_media_data?.media?.file_id) {
        console.log(`Skipping item ${item.id} - missing media data`);
        continue;
      }

      const result = await processMediaItem(supabase, item.message_media_data, botToken);
      
      if (result.success) {
        await supabase
          .from('unified_processing_queue')
          .update({
            status: 'processed',
            processed_at: new Date().toISOString()
          })
          .eq('id', item.id);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error(`Error processing queue item ${item.id}:`, error);
      
      await supabase
        .from('unified_processing_queue')
        .update({
          status: 'error',
          error_message: error.message,
          retry_count: (item.retry_count || 0) + 1
        })
        .eq('id', item.id);
    }
  }
}