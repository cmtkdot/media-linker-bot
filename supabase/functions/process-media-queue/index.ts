import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { processMediaItem } from "../_shared/unified-media-processor.ts";

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
    const { data: queueItems, error } = await supabase
      .from('unified_processing_queue')
      .select('*')
      .in('status', ['pending', 'processing'])
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(10);

    if (error) throw error;

    if (!queueItems?.length) {
      return new Response(
        JSON.stringify({ message: 'No pending items' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${queueItems.length} queue items`);

    // Group items by media_group_id
    const mediaGroups = new Map();
    const singleItems = [];

    for (const item of queueItems) {
      const mediaGroupId = item.message_media_data?.message?.media_group_id;
      
      if (mediaGroupId && item.queue_type === 'media_group') {
        if (!mediaGroups.has(mediaGroupId)) {
          mediaGroups.set(mediaGroupId, []);
        }
        mediaGroups.get(mediaGroupId).push(item);
      } else {
        singleItems.push(item);
      }
    }

    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!botToken) throw new Error('Bot token not configured');

    // Process media groups
    for (const [groupId, items] of mediaGroups) {
      console.log(`Processing media group ${groupId} with ${items.length} items`);
      
      try {
        // Check if group is complete
        const { data: messages } = await supabase
          .from('messages')
          .select('id, media_group_size')
          .eq('media_group_id', groupId)
          .limit(1);

        if (!messages?.length) {
          console.log(`No messages found for group ${groupId}`);
          continue;
        }

        const expectedSize = messages[0].media_group_size;
        if (items.length < expectedSize) {
          console.log(`Media group ${groupId} not complete yet. Has ${items.length}/${expectedSize} items`);
          continue;
        }

        // Process each item in the group
        for (const item of items) {
          await processMediaItem(supabase, item, botToken);
        }

        // Update all items in group as processed
        await supabase
          .from('unified_processing_queue')
          .update({
            status: 'processed',
            processed_at: new Date().toISOString()
          })
          .eq('message_media_data->message->media_group_id', groupId);

      } catch (error) {
        console.error(`Error processing media group ${groupId}:`, error);
        
        // Update error status for the group
        await supabase
          .from('unified_processing_queue')
          .update({
            status: 'failed',
            error_message: error.message,
            retry_count: items[0].retry_count + 1
          })
          .eq('message_media_data->message->media_group_id', groupId);
      }
    }

    // Process single items
    for (const item of singleItems) {
      try {
        await processMediaItem(supabase, item, botToken);
        
        await supabase
          .from('unified_processing_queue')
          .update({
            status: 'processed',
            processed_at: new Date().toISOString()
          })
          .eq('id', item.id);

      } catch (error) {
        console.error(`Error processing item ${item.id}:`, error);
        
        await supabase
          .from('unified_processing_queue')
          .update({
            status: 'failed',
            error_message: error.message,
            retry_count: item.retry_count + 1
          })
          .eq('id', item.id);
      }
    }

    return new Response(
      JSON.stringify({ 
        processed: {
          groups: mediaGroups.size,
          single: singleItems.length
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in process-media-queue:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});