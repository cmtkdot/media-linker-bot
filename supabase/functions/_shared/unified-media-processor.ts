import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { analyzeCaptionWithAI } from "./caption-analyzer.ts";
import { withDatabaseRetry } from "./database-retry.ts";

interface MediaQueueItem {
  id: string;
  data: {
    message: {
      media_group_id?: string;
      caption?: string;
    };
    analysis?: {
      analyzed_content?: Record<string, any>;
    };
    telegram_data: Record<string, any>;
  };
  status: string;
  correlation_id: string;
}

export async function processMediaGroup(
  supabase: any,
  items: MediaQueueItem[],
  groupId: string
) {
  try {
    console.log(`Processing media group ${groupId} with ${items.length} items`);
    
    // Find item with caption
    const captionItem = items.find(item => item.data.message?.caption);
    
    if (!captionItem) {
      console.log(`No caption found for group ${groupId}`);
      return;
    }

    // Analyze caption if not already analyzed
    let analyzedContent = captionItem.data.analysis?.analyzed_content;
    if (!analyzedContent && captionItem.data.message.caption) {
      try {
        analyzedContent = await analyzeCaptionWithAI(captionItem.data.message.caption, supabase);
        console.log('Caption analysis result:', analyzedContent);
      } catch (error) {
        console.error('Error analyzing caption:', error);
        throw error;
      }
    }

    // Update all items in group with shared analyzed content
    for (const item of items) {
      await withDatabaseRetry(async () => {
        const { error: updateError } = await supabase
          .from('telegram_media')
          .update({
            analyzed_content: analyzedContent,
            caption: captionItem.data.message.caption,
            message_media_data: {
              ...item.data,
              analysis: {
                analyzed_content: analyzedContent
              }
            }
          })
          .eq('telegram_data->media_group_id', groupId);

        if (updateError) throw updateError;
      });

      // Mark queue item as processed
      await withDatabaseRetry(async () => {
        const { error: queueError } = await supabase
          .from('unified_processing_queue')
          .update({
            status: 'completed',
            processed_at: new Date().toISOString()
          })
          .eq('id', item.id);

        if (queueError) throw queueError;
      });
    }
  } catch (error) {
    console.error(`Error processing media group ${groupId}:`, error);
    throw error;
  }
}

export async function processStandaloneMedia(
  supabase: any,
  item: MediaQueueItem
) {
  try {
    console.log(`Processing standalone media item ${item.id}`);

    // Analyze caption if present and not already analyzed
    let analyzedContent = item.data.analysis?.analyzed_content;
    if (!analyzedContent && item.data.message?.caption) {
      try {
        analyzedContent = await analyzeCaptionWithAI(item.data.message.caption, supabase);
        console.log('Caption analysis result:', analyzedContent);
      } catch (error) {
        console.error('Error analyzing caption:', error);
      }
    }

    // Update telegram_media record
    await withDatabaseRetry(async () => {
      const { error: updateError } = await supabase
        .from('telegram_media')
        .update({
          analyzed_content: analyzedContent,
          caption: item.data.message?.caption,
          message_media_data: {
            ...item.data,
            analysis: {
              analyzed_content: analyzedContent
            }
          }
        })
        .eq('id', item.correlation_id);

      if (updateError) throw updateError;
    });

    // Mark queue item as processed
    await withDatabaseRetry(async () => {
      const { error: queueError } = await supabase
        .from('unified_processing_queue')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString()
        })
        .eq('id', item.id);

      if (queueError) throw queueError;
    });
  } catch (error) {
    console.error(`Error processing standalone media ${item.id}:`, error);
    throw error;
  }
}