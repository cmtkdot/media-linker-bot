import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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

    // Group items by media_group_id for batch processing
    const mediaGroups = new Map<string, any[]>();
    const standaloneItems = [];

    for (const item of queueItems || []) {
      const mediaGroupId = item.data?.telegram_data?.media_group_id;
      if (mediaGroupId) {
        if (!mediaGroups.has(mediaGroupId)) {
          mediaGroups.set(mediaGroupId, []);
        }
        mediaGroups.get(mediaGroupId)?.push(item);
      } else {
        standaloneItems.push(item);
      }
    }

    // Process standalone items
    for (const item of standaloneItems) {
      try {
        await processQueueItem(supabase, item);
        results.processed++;
      } catch (error) {
        console.error(`Error processing standalone item ${item.id}:`, error);
        results.errors++;
        await updateQueueItemStatus(supabase, item.id, 'error', error.message);
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
        for (const item of items) {
          await updateQueueItemStatus(supabase, item.id, 'error', error.message);
        }
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

  // Find the caption holder (item with analyzed content)
  const captionHolder = items.find(item => 
    item.data?.analysis?.analyzed_content || 
    item.data?.telegram_data?.caption
  );

  if (!captionHolder) {
    console.log(`No caption holder found for group ${groupId}`);
  }

  // Merge and prepare final data for the group
  const groupAnalyzedContent = captionHolder?.data?.analysis?.analyzed_content || {};
  const groupCaption = captionHolder?.data?.telegram_data?.caption;

  // Process each item in the group with shared data
  for (const item of items) {
    try {
      const finalData = {
        ...item.data,
        analysis: {
          analyzed_content: groupAnalyzedContent
        },
        message: {
          ...item.data.message,
          caption: groupCaption
        }
      };

      // Update queue item with final merged data
      await supabase
        .from('unified_processing_queue')
        .update({ 
          data: finalData,
          status: 'processing'
        })
        .eq('id', item.id);

      // Process the item with merged data
      await processQueueItem(supabase, { ...item, data: finalData });

      // Mark as completed
      await updateQueueItemStatus(supabase, item.id, 'completed');

    } catch (error) {
      console.error(`Error processing group item ${item.id}:`, error);
      await updateQueueItemStatus(supabase, item.id, 'error', error.message);
      throw error;
    }
  }
}

async function processQueueItem(supabase: any, item: any) {
  console.log('Processing queue item:', item.id);

  try {
    const mediaData = item.data?.telegram_data;
    if (!mediaData) {
      throw new Error('No media data found');
    }

    // Extract media file information
    const mediaFile = mediaData.photo?.[mediaData.photo.length - 1] || 
                     mediaData.video || 
                     mediaData.document;

    if (!mediaFile) {
      throw new Error('No media file found');
    }

    const fileId = mediaFile.file_id;
    const fileUniqueId = mediaFile.file_unique_id;
    const fileType = mediaData.photo ? 'photo' : 
                    mediaData.video ? 'video' : 'document';

    // Prepare final data for telegram_media
    const telegramMediaData = {
      file_id: fileId,
      file_unique_id: fileUniqueId,
      file_type: fileType,
      message_id: item.message_id,
      analyzed_content: item.data.analysis?.analyzed_content || {},
      telegram_data: mediaData,
      message_media_data: item.data,
      caption: item.data.message?.caption,
      product_name: item.data.analysis?.analyzed_content?.product_name,
      product_code: item.data.analysis?.analyzed_content?.product_code,
      quantity: item.data.analysis?.analyzed_content?.quantity,
      vendor_uid: item.data.analysis?.analyzed_content?.vendor_uid,
      purchase_date: item.data.analysis?.analyzed_content?.purchase_date,
      notes: item.data.analysis?.analyzed_content?.notes
    };

    // Insert into telegram_media
    const { error: insertError } = await supabase
      .from('telegram_media')
      .insert([telegramMediaData]);

    if (insertError) throw insertError;

    // Update queue item status
    await updateQueueItemStatus(supabase, item.id, 'completed');

  } catch (error) {
    console.error(`Error processing item ${item.id}:`, error);
    await updateQueueItemStatus(supabase, item.id, 'error', error.message);
    throw error;
  }
}

async function updateQueueItemStatus(
  supabase: any, 
  itemId: string, 
  status: 'processing' | 'completed' | 'error', 
  errorMessage?: string
) {
  const updates: any = {
    status,
    processed_at: status === 'completed' ? new Date().toISOString() : null
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