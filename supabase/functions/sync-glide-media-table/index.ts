import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { GlideAPI } from './glideApi.ts';
import { corsHeaders } from './cors.ts';
import { mapSupabaseToGlide, mapGlideToSupabase } from './productMapper.ts';
import { QueueProcessor } from './queueProcessor.ts';
import type { SyncResult, GlideConfig, GlideSyncQueueItem } from '../_shared/types.ts';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      headers: {
        ...corsHeaders,
        'Access-Control-Max-Age': '86400',
      }
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Parse request body with error handling
    let body;
    try {
      body = await req.json();
      console.log('Received body:', JSON.stringify(body));
    } catch (error) {
      console.error('Error parsing request body:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid request body',
          details: error.message 
        }), 
        { 
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }
    
    const { operation, tableId } = body;

    if (!operation || !tableId) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required parameters: operation and tableId' 
        }), 
        { 
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    console.log('Starting sync operation:', { operation, tableId });

    const { data: config, error: configError } = await supabase
      .from('glide_config')
      .select('*')
      .eq('id', tableId)
      .maybeSingle();

    if (configError) {
      console.error('Config error:', configError);
      return new Response(
        JSON.stringify({ error: configError.message }), 
        { 
          status: 500,
          headers: corsHeaders
        }
      );
    }

    if (!config) {
      return new Response(
        JSON.stringify({ error: 'Configuration not found' }), 
        { 
          status: 404,
          headers: corsHeaders
        }
      );
    }

    if (!config.supabase_table_name) {
      return new Response(
        JSON.stringify({ error: 'No Supabase table linked' }), 
        { 
          status: 400,
          headers: corsHeaders
        }
      );
    }

    if (!config.api_token) {
      return new Response(
        JSON.stringify({ error: 'Glide API token not configured' }), 
        { 
          status: 400,
          headers: corsHeaders
        }
      );
    }

    const result: SyncResult = {
      added: 0,
      updated: 0,
      deleted: 0,
      errors: []
    };

    // Get unprocessed queue items
    const { data: queueItems, error: queueError } = await supabase
      .from('glide_sync_queue')
      .select('*')
      .eq('table_name', config.supabase_table_name)
      .is('processed_at', null)
      .order('created_at');

    if (queueError) {
      console.error('Queue error:', queueError);
      return new Response(
        JSON.stringify({ error: queueError.message }), 
        { 
          status: 500,
          headers: corsHeaders
        }
      );
    }

    console.log(`Found ${queueItems?.length || 0} pending sync items`);

    const glideApi = new GlideAPI(config.app_id, config.table_id, config.api_token);
    const queueProcessor = new QueueProcessor(supabase, config, glideApi);
    
    // Process each queue item
    for (const item of queueItems || []) {
      try {
        await queueProcessor.processQueueItem(item, result);
        
        // Mark item as processed
        const { error: updateError } = await supabase
          .from('glide_sync_queue')
          .update({ 
            processed_at: new Date().toISOString(),
            error: null
          })
          .eq('id', item.id);

        if (updateError) {
          console.error('Error updating queue item:', updateError);
          result.errors.push(`Failed to mark item ${item.id} as processed: ${updateError.message}`);
        }
      } catch (error) {
        console.error('Error processing queue item:', error);
        result.errors.push(`Error processing item ${item.id}: ${error.message}`);
        
        // Update error information
        const { error: updateError } = await supabase
          .from('glide_sync_queue')
          .update({ 
            error: error.message,
            retry_count: (item.retry_count || 0) + 1
          })
          .eq('id', item.id);

        if (updateError) {
          console.error('Error updating queue item error status:', updateError);
        }
      }
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
        error: error.message,
        stack: error.stack
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
