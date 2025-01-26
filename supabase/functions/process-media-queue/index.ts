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
    console.log('Starting process-media-queue function');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN is not configured');
    }

    // Get pending queue items
    const { data: queueItems, error: queueError } = await supabase
      .from('unified_processing_queue')
      .select('*')
      .eq('status', 'pending')
      .eq('queue_type', 'media')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(10);

    if (queueError) {
      console.error('Error fetching queue items:', queueError);
      throw queueError;
    }

    console.log(`Found ${queueItems?.length || 0} pending queue items`);

    const results = [];
    const errors = [];

    // Process each item independently
    for (const item of queueItems || []) {
      try {
        console.log(`Processing queue item ${item.id}:`, {
          queue_type: item.queue_type,
          message_id: item.message_id,
          chat_id: item.chat_id,
          has_media_data: !!item.message_media_data
        });

        const result = await processMediaItem(supabase, item, botToken);
        console.log(`Successfully processed item ${item.id}:`, {
          media_id: result.id,
          public_url: result.public_url
        });
        
        results.push({
          item_id: item.id,
          status: 'processed',
          media_id: result.id
        });
      } catch (error) {
        console.error(`Error processing item ${item.id}:`, {
          error: error.message,
          code: error.code,
          item_data: {
            message_id: item.message_id,
            chat_id: item.chat_id,
            queue_type: item.queue_type
          }
        });
        
        errors.push({
          item_id: item.id,
          error: error.message,
          code: error.code
        });

        // Update queue item with error
        const { error: updateError } = await supabase
          .from('unified_processing_queue')
          .update({
            status: 'error',
            error_message: error.message,
            retry_count: (item.retry_count || 0) + 1,
            processed_at: new Date().toISOString()
          })
          .eq('id', item.id);

        if (updateError) {
          console.error(`Error updating queue item ${item.id}:`, updateError);
        }
      }
    }

    console.log('Queue processing complete:', {
      processed: results.length,
      errors: errors.length
    });

    return new Response(
      JSON.stringify({
        processed: results.length,
        errors: errors.length,
        results,
        errors
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