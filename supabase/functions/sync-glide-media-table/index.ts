import { serve } from "https://deno.land/std@0.131.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GlideAPI } from "./glideApi.ts";
import { QueueProcessor } from "./queueProcessor.ts";
import { corsHeaders } from "../_shared/cors.ts";

const BATCH_SIZE = 10;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Max-Age': '86400',
      }
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get active Glide configurations
    const { data: configs, error: configError } = await supabase
      .from('glide_config')
      .select('*')
      .eq('active', true);

    if (configError) {
      throw configError;
    }

    if (!configs || configs.length === 0) {
      throw new Error('No active Glide configuration found');
    }

    // Use the first active config
    const config = configs[0];
    console.log('Using Glide config:', config);

    if (!config.supabase_table_name) {
      throw new Error('No table name specified in Glide configuration');
    }

    // Initialize Glide API client
    const glideApi = new GlideAPI(
      config.app_id,
      config.table_id,
      config.api_token,
      supabase
    );

    // Initialize queue processor
    const queueProcessor = new QueueProcessor(supabase, config, glideApi);

    // Get unprocessed items from queue
    const { data: queueItems, error: queueError } = await supabase
      .from('glide_sync_queue')
      .select('*')
      .is('processed_at', null)
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (queueError) {
      throw queueError;
    }

    console.log(`Found ${queueItems?.length || 0} items to process`);

    const result = {
      added: 0,
      updated: 0,
      deleted: 0,
      errors: [] as string[]
    };

    // Process each queue item
    for (const item of queueItems || []) {
      try {
        await queueProcessor.processQueueItem(item, result);
      } catch (error) {
        console.error('Error processing queue item:', error);
        result.errors.push(`Error processing item ${item.id}: ${error.message}`);
      }
    }

    // Clean up processed items older than 24 hours
    const { error: cleanupError } = await supabase
      .from('glide_sync_queue')
      .delete()
      .lt('processed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (cleanupError) {
      console.error('Error cleaning up processed items:', cleanupError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: result
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200 
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