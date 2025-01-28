import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { QueueItem, ProcessingResult } from "./types.ts";
import { processMediaItem } from "./media-processor.ts";

export async function processMediaGroup(
  supabase: any,
  groupId: string,
  items: QueueItem[],
  botToken: string
): Promise<ProcessingResult> {
  try {
    console.log(`Processing media group ${groupId} with ${items.length} items`);

    const originalItem = items.find(item => 
      item.message_media_data?.meta?.is_original_caption
    );

    // Process each item in the group
    for (const item of items) {
      const result = await processMediaItem(supabase, item, botToken);
      if (!result.success) {
        throw new Error(`Failed to process group item: ${result.error}`);
      }
    }

    return { success: true };
  } catch (error) {
    console.error(`Error processing media group ${groupId}:`, error);
    return { 
      success: false, 
      error: `Failed to process media group: ${error.message}`
    };
  }
}

export async function isMediaGroupComplete(
  supabase: any,
  mediaGroupId: string
): Promise<boolean> {
  const { data: messages, error } = await supabase
    .from('messages')
    .select('id, analyzed_content')
    .eq('media_group_id', mediaGroupId);

  if (error) {
    console.error('Error checking media group completeness:', error);
    return false;
  }

  return messages.every(msg => msg.analyzed_content !== null);
}