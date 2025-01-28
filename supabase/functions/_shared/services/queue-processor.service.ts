import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { QueueItem } from "../types/queue.types.ts";
import { processMediaItem } from "./media-processor.service.ts";

export async function processQueue(supabase: any, items: QueueItem[]) {
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

      await processMediaItem(supabase, item, botToken);
    } catch (error) {
      console.error(`Error processing queue item ${item.id}:`, error);
    }
  }
}