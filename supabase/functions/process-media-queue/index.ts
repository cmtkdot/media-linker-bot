import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withDatabaseRetry } from "../_shared/database-retry.ts";
import { processMediaGroup, processStandaloneMedia } from "../_shared/unified-media-processor.ts";

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

    // Get pending queue items in batches
    const { data: queueItems, error: queueError } = await supabase
      .from('unified_processing_queue')
      .select('*')
      .eq('status', 'pending')
      .eq('queue_type', 'media')
      .order('created_at', { ascending: true })
      .limit(10);

    if (queueError) throw queueError;

    console.log(`Processing ${queueItems?.length || 0} queue items`);

    // Group items by media_group_id
    const mediaGroups = new Map();
    const standaloneItems = [];

    for (const item of queueItems || []) {
      const mediaGroupId = item.data?.message?.media_group_id;
      
      if (mediaGroupId) {
        if (!mediaGroups.has(mediaGroupId)) {
          mediaGroups.set(mediaGroupId, []);
        }
        mediaGroups.get(mediaGroupId).push(item);
      } else {
        standaloneItems.push(item);
      }
    }

    const results = [];

    // Process media groups
    for (const [groupId, items] of mediaGroups) {
      try {
        console.log(`Processing media group ${groupId} with ${items.length} items`);
        await processMediaGroup(supabase, items, groupId);
        results.push({
          group_id: groupId,
          status: 'processed',
          items_count: items.length
        });
      } catch (error) {
        console.error(`Error processing media group ${groupId}:`, error);
        results.push({
          group_id: groupId,
          status: 'error',
          error: error.message
        });

        // Update all items in the group with error status
        for (const item of items) {
          await withDatabaseRetry(async () => {
            const { error: updateError } = await supabase
              .from('unified_processing_queue')
              .update({
                status: 'error',
                error_message: error.message,
                retry_count: (item.retry_count || 0) + 1
              })
              .eq('id', item.id);

            if (updateError) throw updateError;
          });
        }
      }
    }

    // Process standalone items
    for (const item of standaloneItems) {
      try {
        console.log(`Processing standalone media item ${item.id}`);
        await processStandaloneMedia(supabase, item);
        results.push({
          item_id: item.id,
          status: 'processed'
        });
      } catch (error) {
        console.error(`Error processing standalone item ${item.id}:`, error);
        results.push({
          item_id: item.id,
          status: 'error',
          error: error.message
        });

        await withDatabaseRetry(async () => {
          const { error: updateError } = await supabase
            .from('unified_processing_queue')
            .update({
              status: 'error',
              error_message: error.message,
              retry_count: (item.retry_count || 0) + 1
            })
            .eq('id', item.id);

          if (updateError) throw updateError;
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        processed: results.length, 
        groups_processed: mediaGroups.size,
        standalone_processed: standaloneItems.length,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing queue:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});