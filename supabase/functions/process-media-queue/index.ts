import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get pending queue items
    const { data: queueItems, error: queueError } = await supabase
      .from('unified_processing_queue')
      .select('*')
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(10);

    if (queueError) throw queueError;

    console.log(`Processing ${queueItems?.length || 0} queue items`);

    const results = {
      processed: 0,
      errors: 0,
      details: [] as any[]
    };

    // Group items by media_group_id
    const mediaGroups = new Map<string, any[]>();
    
    for (const item of queueItems || []) {
      const mediaGroupId = item.data?.telegram_data?.media_group_id;
      
      if (mediaGroupId) {
        if (!mediaGroups.has(mediaGroupId)) {
          mediaGroups.set(mediaGroupId, []);
        }
        mediaGroups.get(mediaGroupId)?.push(item);
      } else {
        // Process individual items immediately
        await processQueueItem(supabase, item);
        results.processed++;
      }
    }

    // Process media groups
    for (const [groupId, items] of mediaGroups.entries()) {
      try {
        await processMediaGroup(supabase, groupId, items);
        results.processed += items.length;
      } catch (error) {
        console.error(`Error processing media group ${groupId}:`, error);
        results.errors += items.length;
      }
    }

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in queue processor:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});

async function processMediaGroup(supabase: any, groupId: string, items: any[]) {
  console.log(`Processing media group ${groupId} with ${items.length} items`);

  // Find the caption holder
  const captionHolder = items.find(item => 
    item.data?.telegram_data?.caption || 
    item.data?.message?.caption
  );

  if (!captionHolder) {
    console.log(`No caption holder found for group ${groupId}`);
    return;
  }

  const analyzedContent = captionHolder.data?.analysis?.analyzed_content;
  
  if (!analyzedContent) {
    console.log(`No analyzed content for group ${groupId}`);
    return;
  }

  // Update all items in the group with the analyzed content
  for (const item of items) {
    try {
      // First update the messages table
      if (item.message_id && item.chat_id) {
        const { error: messageError } = await supabase
          .from('messages')
          .update({
            analyzed_content: analyzedContent,
            caption: captionHolder.data?.telegram_data?.caption || captionHolder.data?.message?.caption
          })
          .eq('message_id', item.message_id)
          .eq('chat_id', item.chat_id);

        if (messageError) throw messageError;
      }

      // Then process the media file
      await processQueueItem(supabase, item, analyzedContent);

    } catch (error) {
      console.error(`Error processing group item ${item.id}:`, error);
      await updateQueueItemStatus(supabase, item.id, 'error', error.message);
      throw error;
    }
  }
}

async function processQueueItem(supabase: any, item: any, groupAnalyzedContent?: any) {
  console.log('Processing queue item:', item.id);

  try {
    const mediaData = item.data?.telegram_data;
    if (!mediaData) {
      throw new Error('No media data found');
    }

    // Use group analyzed content or item's own analyzed content
    const analyzedContent = groupAnalyzedContent || item.data?.analysis?.analyzed_content;

    // Upload media to storage if needed
    if (mediaData.photo || mediaData.video || mediaData.document) {
      const mediaFile = mediaData.photo?.[mediaData.photo.length - 1] || 
                       mediaData.video || 
                       mediaData.document;

      const fileId = mediaFile.file_id;
      const fileUniqueId = mediaFile.file_unique_id;
      const fileType = mediaData.photo ? 'photo' : 
                      mediaData.video ? 'video' : 'document';

      // Create telegram_media record
      const { error: mediaError } = await supabase
        .from('telegram_media')
        .insert({
          file_id: fileId,
          file_unique_id: fileUniqueId,
          file_type: fileType,
          message_id: item.message_id,
          analyzed_content: analyzedContent,
          telegram_data: mediaData,
          message_media_data: item.data,
          caption: mediaData.caption
        });

      if (mediaError) throw mediaError;
    }

    // Update queue item status
    await updateQueueItemStatus(supabase, item.id, 'processed');

  } catch (error) {
    console.error(`Error processing item ${item.id}:`, error);
    await updateQueueItemStatus(supabase, item.id, 'error', error.message);
    throw error;
  }
}

async function updateQueueItemStatus(
  supabase: any, 
  itemId: string, 
  status: 'processed' | 'error', 
  errorMessage?: string
) {
  const updates: any = {
    status,
    processed_at: new Date().toISOString()
  };

  if (status === 'error') {
    updates.error_message = errorMessage;
    updates.retry_count = supabase.sql`retry_count + 1`;
  }

  const { error } = await supabase
    .from('unified_processing_queue')
    .update(updates)
    .eq('id', itemId);

  if (error) {
    console.error('Error updating queue item status:', error);
    throw error;
  }
}