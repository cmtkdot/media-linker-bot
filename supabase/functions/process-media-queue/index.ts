import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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

    // Get pending queue items
    const { data: queueItems, error: queueError } = await supabase
      .from('unified_processing_queue')
      .select('*')
      .eq('status', 'pending')
      .eq('queue_type', 'media')
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
    const standaloneItems = [];

    for (const item of queueItems || []) {
      const mediaGroupId = item.data?.message?.media_group_id;
      if (mediaGroupId) {
        if (!mediaGroups.has(mediaGroupId)) {
          mediaGroups.set(mediaGroupId, []);
        }
        mediaGroups.get(mediaGroupId)?.push(item);
      } else {
        standaloneItems.push(item);
      }
    }

    // Process media groups
    for (const [groupId, items] of mediaGroups.entries()) {
      try {
        await processMediaGroup(supabase, items, groupId);
        results.processed += items.length;
      } catch (error) {
        console.error(`Error processing group ${groupId}:`, error);
        results.errors += items.length;
        results.details.push({
          group_id: groupId,
          error: error.message
        });

        // Update failed items
        for (const item of items) {
          await supabase
            .from('unified_processing_queue')
            .update({
              status: 'error',
              error_message: error.message,
              retry_count: supabase.sql`retry_count + 1`
            })
            .eq('id', item.id);
        }
      }
    }

    // Process standalone items
    for (const item of standaloneItems) {
      try {
        await processStandaloneMedia(supabase, item);
        results.processed++;
      } catch (error) {
        console.error(`Error processing standalone item ${item.id}:`, error);
        results.errors++;
        results.details.push({
          item_id: item.id,
          error: error.message
        });

        await supabase
          .from('unified_processing_queue')
          .update({
            status: 'error',
            error_message: error.message,
            retry_count: supabase.sql`retry_count + 1`
          })
          .eq('id', item.id);
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