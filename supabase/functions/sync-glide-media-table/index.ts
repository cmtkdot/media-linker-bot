import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { GlideAPI } from './glideApi.ts';
import { corsHeaders } from './cors.ts';
import { mapSupabaseToGlide, mapGlideToSupabase } from './productMapper.ts';
import { QueueProcessor } from './queueProcessor.ts';
import type { SyncResult, GlideConfig, GlideSyncQueueItem } from '../_shared/types.ts';

interface SyncStats {
  processedItems: number;
  skippedItems: number;
  errorItems: number;
  totalTime: number;
  details: {
    operation: string;
    status: string;
    timestamp: string;
    error?: string;
  }[];
}

serve(async (req) => {
  const startTime = Date.now();
  const stats: SyncStats = {
    processedItems: 0,
    skippedItems: 0,
    errorItems: 0,
    totalTime: 0,
    details: []
  };

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
    console.log('Starting sync operation...');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    let body;
    try {
      body = await req.json();
      console.log('Received request body:', JSON.stringify(body));
    } catch (error) {
      console.error('Error parsing request body:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid request body',
          details: error.message,
          stats 
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
          error: 'Missing required parameters: operation and tableId',
          stats 
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

    console.log(`Fetching configuration for table ID: ${tableId}`);
    const { data: config, error: configError } = await supabase
      .from('glide_config')
      .select('*')
      .eq('id', tableId)
      .maybeSingle();

    if (configError) {
      console.error('Configuration error:', configError);
      return new Response(
        JSON.stringify({ 
          error: configError.message,
          stats 
        }), 
        { 
          status: 500,
          headers: corsHeaders
        }
      );
    }

    if (!config) {
      return new Response(
        JSON.stringify({ 
          error: 'Configuration not found',
          stats 
        }), 
        { 
          status: 404,
          headers: corsHeaders
        }
      );
    }

    console.log(`Using configuration for table: ${config.table_name}`);

    const result: SyncResult = {
      added: 0,
      updated: 0,
      deleted: 0,
      errors: []
    };

    // Get unprocessed queue items
    console.log('Fetching unprocessed queue items...');
    const { data: queueItems, error: queueError } = await supabase
      .from('glide_sync_queue')
      .select('*')
      .eq('table_name', config.supabase_table_name)
      .is('processed_at', null)
      .order('created_at');

    if (queueError) {
      console.error('Queue error:', queueError);
      return new Response(
        JSON.stringify({ 
          error: queueError.message,
          stats 
        }), 
        { 
          status: 500,
          headers: corsHeaders
        }
      );
    }

    console.log(`Found ${queueItems?.length || 0} pending sync items`);
    
    if (!queueItems || queueItems.length === 0) {
      stats.totalTime = Date.now() - startTime;
      return new Response(
        JSON.stringify({
          message: 'No items to sync',
          result,
          stats
        }),
        { 
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    const glideApi = new GlideAPI(config.app_id, config.table_id, config.api_token);
    const queueProcessor = new QueueProcessor(supabase, config, glideApi);
    
    // Process each queue item
    for (const item of queueItems) {
      try {
        console.log(`Processing item ${item.id} - Operation: ${item.operation}`);
        const startItemTime = Date.now();
        
        await queueProcessor.processQueueItem(item, result);
        stats.processedItems++;
        
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
          stats.errorItems++;
        }

        stats.details.push({
          operation: item.operation,
          status: 'success',
          timestamp: new Date().toISOString(),
        });

        console.log(`Completed processing item ${item.id} in ${Date.now() - startItemTime}ms`);

      } catch (error) {
        console.error(`Error processing item ${item.id}:`, error);
        result.errors.push(`Error processing item ${item.id}: ${error.message}`);
        stats.errorItems++;
        
        stats.details.push({
          operation: item.operation,
          status: 'error',
          timestamp: new Date().toISOString(),
          error: error.message
        });

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

    stats.totalTime = Date.now() - startTime;
    console.log('Sync completed:', {
      result,
      stats,
      totalTimeMs: stats.totalTime
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: result,
        stats,
        summary: `Processed ${stats.processedItems} items (${result.added} added, ${result.updated} updated, ${result.deleted} deleted) with ${stats.errorItems} errors in ${stats.totalTime}ms`
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
    stats.totalTime = Date.now() - startTime;
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack,
        stats
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