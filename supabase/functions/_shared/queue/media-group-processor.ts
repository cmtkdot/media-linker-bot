import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { QueueItem, ProcessingResult } from "./types.ts";
import { processQueueItem } from "./queue-item-processor.ts";

export async function isMediaGroupComplete(supabase: any, mediaGroupId: string): Promise<boolean> {
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

export async function waitForMediaGroupCompletion(
  supabase: any, 
  mediaGroupId: string, 
  maxAttempts = 5
): Promise<boolean> {
  console.log(`Waiting for media group ${mediaGroupId} to complete...`);
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const isComplete = await isMediaGroupComplete(supabase, mediaGroupId);
    
    if (isComplete) {
      console.log(`Media group ${mediaGroupId} is complete after ${attempt + 1} attempts`);
      return true;
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log(`Media group ${mediaGroupId} incomplete after ${maxAttempts} attempts`);
  return false;
}

export async function processMediaGroup(
  supabase: any, 
  groupId: string, 
  items: QueueItem[]
): Promise<ProcessingResult> {
  try {
    const originalItem = items.find(item => 
      item.message_media_data?.meta?.is_original_caption
    );

    const analyzedContent = originalItem?.message_media_data?.analysis?.analyzed_content;

    console.log('Processing media group:', {
      group_id: groupId,
      items_count: items.length,
      has_original_caption: !!originalItem,
      has_analyzed_content: !!analyzedContent
    });

    for (const item of items) {
      if (analyzedContent && !item.message_media_data?.meta?.is_original_caption) {
        item.message_media_data.analysis.analyzed_content = analyzedContent;
      }

      await processQueueItem(supabase, item, originalItem);
    }

    await supabase
      .from('unified_processing_queue')
      .update({
        status: 'processed',
        processed_at: new Date().toISOString()
      })
      .in('id', items.map(item => item.id));

    return { success: true };

  } catch (error) {
    console.error(`Error processing media group ${groupId}:`, error);
    return { 
      success: false, 
      error: `Failed to process media group: ${error.message}` 
    };
  }
}