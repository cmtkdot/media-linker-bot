import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { processMediaItem } from "../_shared/queue/media-processor.ts";

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
    console.log('Starting queue processing');

    // Fetch pending queue items
    const { data: queueItems, error: queueError } = await supabase
      .from('unified_processing_queue')
      .select('*')
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(10);

    if (queueError) {
      console.error('Error fetching queue items:', queueError);
      throw queueError;
    }

    if (!queueItems?.length) {
      return new Response(
        JSON.stringify({ message: 'No pending items' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${queueItems.length} queue items`);

    // Process each item directly using message_media_data
    for (const item of queueItems) {
      console.log(`Processing item ${item.id}`);
      
      // Skip if message_media_data is missing required fields
      if (!item.message_media_data?.media?.file_id) {
        console.log(`Skipping item ${item.id} - missing media data`);
        continue;
      }

      await processMediaItem(supabase, item, botToken);
    }

    // Mark processed items as complete
    const processedIds = queueItems.map(item => item.id);
    
    if (processedIds.length > 0) {
      console.log(`Marking ${processedIds.length} items as processed`);
      
      const { error: updateError } = await supabase
        .from('unified_processing_queue')
        .update({
          status: 'processed',
          processed_at: new Date().toISOString()
        })
        .in('id', processedIds);

      if (updateError) {
        console.error('Error updating queue items:', updateError);
        throw updateError;
      }
    }

    return new Response(
      JSON.stringify({ 
        processed: queueItems.length
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