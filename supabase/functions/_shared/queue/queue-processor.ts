import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { QueueItem } from "./types.ts";
import { processMediaGroup, waitForMediaGroupCompletion } from "./media-group-processor.ts";
import { processQueueItem } from "./queue-item-processor.ts";

export async function processMediaGroups(supabase: any, items: QueueItem[]) {
  const mediaGroups = new Map<string, QueueItem[]>();
  
  items.forEach(item => {
    const groupId = item.message_media_data?.message?.media_group_id;
    if (groupId) {
      if (!mediaGroups.has(groupId)) {
        mediaGroups.set(groupId, []);
      }
      mediaGroups.get(groupId)?.push(item);
    }
  });

  console.log(`Processing ${mediaGroups.size} media groups`);

  for (const [groupId, groupItems] of mediaGroups) {
    console.log(`Checking media group ${groupId} with ${groupItems.length} items`);
    
    const isComplete = await waitForMediaGroupCompletion(supabase, groupId);
    
    if (!isComplete) {
      console.log(`Skipping incomplete media group ${groupId}`);
      continue;
    }

    await processMediaGroup(supabase, groupId, groupItems);
  }
}

export { processQueueItem };