import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { processMediaGroups, processQueueItem } from "../_shared/queue/queue-processor.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { data: queueItems, error: queueError } = await supabase
      .from('unified_processing_queue')
      .select('*')
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(10);

    if (queueError) throw queueError;

    if (!queueItems?.length) {
      return new Response(
        JSON.stringify({ message: 'No pending items' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${queueItems.length} queue items`);

    const groupItems = queueItems.filter(item => 
      item.message_media_data?.message?.media_group_id
    );
    
    if (groupItems.length > 0) {
      await processMediaGroups(supabase, groupItems);
    }

    const individualItems = queueItems.filter(item => 
      !item.message_media_data?.message?.media_group_id
    );

    for (const item of individualItems) {
      await processQueueItem(supabase, item);
    }

    await cleanupProcessedItems(supabase);

    return new Response(
      JSON.stringify({ 
        processed: queueItems.length,
        groups: groupItems.length,
        individual: individualItems.length
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

async function cleanupProcessedItems(supabase: any) {
  const { error } = await supabase
    .from('unified_processing_queue')
    .delete()
    .eq('status', 'processed')
    .lt('processed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  if (error) {
    console.error('Error cleaning up processed items:', error);
  }
}