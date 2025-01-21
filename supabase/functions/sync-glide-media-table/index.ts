import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { SyncResult } from './types.ts';
import { QueueProcessor } from './queueProcessor.ts';
import { GlideAPI } from './glideApi.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();
    const { operation, tableId } = body;

    if (!operation || !tableId) {
      throw new Error('Missing required parameters: operation and tableId');
    }

    console.log('Starting sync operation:', { operation, tableId });

    const { data: config, error: configError } = await supabase
      .from('glide_config')
      .select('*')
      .eq('id', tableId)
      .maybeSingle();

    if (configError) throw configError;
    if (!config) throw new Error('Configuration not found');
    if (!config.supabase_table_name) throw new Error('No Supabase table linked');
    if (!config.api_token) throw new Error('Glide API token not configured');

    const result: SyncResult = {
      added: 0,
      updated: 0,
      deleted: 0,
      errors: []
    };

    const { data: queueItems, error: queueError } = await supabase
      .from('glide_sync_queue')
      .select('*')
      .eq('table_name', config.supabase_table_name)
      .is('processed_at', null)
      .order('created_at');

    if (queueError) throw queueError;

    console.log(`Found ${queueItems?.length || 0} pending sync items`);

    const glideApi = new GlideAPI(config.app_id, config.table_id, config.api_token);
    const queueProcessor = new QueueProcessor(supabase, config, glideApi);

    for (const item of queueItems || []) {
      await queueProcessor.processQueueItem(item, result);
    }

    console.log('Sync completed:', result);

    return new Response(
      JSON.stringify({
        success: true,
        data: result
      }),
      { 
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    console.error('Error in sync operation:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
});