import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { processMediaGroup, isMediaGroupComplete } from "../_shared/queue/media-group-processor.ts";
import { processMediaItem } from "../_shared/queue/media-processor.ts";
import { QueueItem } from "../_shared/queue/types.ts";

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

  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!botToken) {
    throw new Error('Bot token not configured');
  }

  try {
    // Fetch pending queue items
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

    // Group items by media_group_id
    const mediaGroups = new Map<string, QueueItem[]>();
    const individualItems: QueueItem[] = [];

    queueItems.forEach(item => {
      const groupId = item.message_media_data?.message?.media_group_id;
      if (groupId) {
        if (!mediaGroups.has(groupId)) {
          mediaGroups.set(groupId, []);
        }
        mediaGroups.get(groupId)?.push(item);
      } else {
        individualItems.push(item);
      }
    });

    // Process media groups
    for (const [groupId, groupItems] of mediaGroups) {
      const isComplete = await isMediaGroupComplete(supabase, groupId);
      if (!isComplete) {
        console.log(`Skipping incomplete media group ${groupId}`);
        continue;
      }

      await processMediaGroup(supabase, groupId, groupItems, botToken);
    }

    // Process individual items
    for (const item of individualItems) {
      await processMediaItem(supabase, item, botToken);
    }

    // Update processed items status
    const processedIds = queueItems
      .filter(item => !item.message_media_data?.message?.media_group_id)
      .map(item => item.id);

    if (processedIds.length > 0) {
      await supabase
        .from('unified_processing_queue')
        .update({
          status: 'processed',
          processed_at: new Date().toISOString()
        })
        .in('id', processedIds);
    }

    return new Response(
      JSON.stringify({ 
        processed: queueItems.length,
        groups: mediaGroups.size,
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