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

    // Get unprocessed queue items
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

    // Process each queue item
    for (const item of queueItems || []) {
      try {
        await queueProcessor.processQueueItem(item, result);
        
        // Mark item as processed and update retry count
        const { error: updateError } = await supabase
          .from('glide_sync_queue')
          .update({
            processed_at: new Date().toISOString(),
            retry_count: (item.retry_count || 0) + 1
          })
          .eq('id', item.id);

        if (updateError) {
          console.error('Error updating queue item:', updateError);
          result.errors.push(`Failed to mark item ${item.id} as processed: ${updateError.message}`);
        }

        // Delete processed items
        const { error: deleteError } = await supabase
          .from('glide_sync_queue')
          .delete()
          .eq('id', item.id)
          .not('processed_at', 'is', null);

        if (deleteError) {
          console.error('Error deleting processed queue item:', deleteError);
          result.errors.push(`Failed to delete processed item ${item.id}: ${deleteError.message}`);
        }
      } catch (error) {
        console.error('Error processing queue item:', error);
        result.errors.push(`Error processing item ${item.id}: ${error.message}`);
        
        // Update error status
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