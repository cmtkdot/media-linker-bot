import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "./cors.ts";
import { QueueProcessor } from "./queueProcessor.ts";
import { GlideAPI } from "./glideApi.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get active Glide config
    const { data: config, error: configError } = await supabase
      .from('glide_config')
      .select('*')
      .eq('active', true)
      .single();

    if (configError) throw configError;
    if (!config) throw new Error('No active Glide configuration found');

    const glideApi = new GlideAPI(
      config.app_id,
      config.table_id,
      config.api_token,
      supabase
    );

    const processor = new QueueProcessor(supabase, config, glideApi);

    // Get unprocessed items from queue
    const { data: queueItems, error: queueError } = await supabase
      .from('glide_sync_queue')
      .select('*')
      .is('processed_at', null)
      .order('created_at', { ascending: true })
      .limit(100);

    if (queueError) throw queueError;

    console.log(`Processing ${queueItems?.length || 0} queue items`);

    const results = {
      processed: 0,
      errors: 0,
      details: [] as any[]
    };

    // Process each item
    for (const item of queueItems || []) {
      try {
        await processor.processQueueItem(item);
        results.processed++;
        results.details.push({
          id: item.id,
          status: 'success',
          operation: item.operation
        });
      } catch (error) {
        console.error('Error processing queue item:', {
          item_id: item.id,
          error: error.message
        });
        results.errors++;
        results.details.push({
          id: item.id,
          status: 'error',
          operation: item.operation,
          error: error.message
        });
      }
    }

    return new Response(
      JSON.stringify(results),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    console.error('Error in sync function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 400
      }
    );
  }
});