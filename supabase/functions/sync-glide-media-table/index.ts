import { serve } from "https://deno.land/std@0.131.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GlideAPI } from "./glideApi.ts";
import { QueueProcessor } from "./queueProcessor.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createSyncLogger, SyncErrorType } from "../_shared/sync-logger.ts";
import { v4 as uuidv4 } from 'https://esm.sh/uuid@9.0.0';

const BATCH_SIZE = 500; // Updated to Glide's max batch size

serve(async (req: Request) => {
  const correlationId = uuidv4();
  const logger = createSyncLogger(correlationId);

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
    console.log('Starting sync process with correlation ID:', correlationId);
    logger.log({
      operation: 'sync_start',
      status: 'success',
      details: { method: req.method }
    });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Record health check
    await supabase
      .from('sync_health_checks')
      .insert({
        check_type: 'sync_start',
        status: 'running',
        details: { correlation_id: correlationId }
      });

    // Get active Glide configurations
    const { data: configs, error: configError } = await supabase
      .from('glide_config')
      .select('*')
      .eq('active', true);

    if (configError) {
      console.error('Error fetching Glide config:', configError);
      throw configError;
    }

    if (!configs || configs.length === 0) {
      throw new Error('No active Glide configuration found');
    }

    const config = configs[0];
    const glideApi = new GlideAPI(config.app_id, config.table_id, config.api_token, supabase);
    const queueProcessor = new QueueProcessor(supabase, config, glideApi, logger);

    // First, process any pending deletions
    console.log('Processing pending deletions...');
    const { data: pendingDeletions, error: deletionError } = await supabase
      .from('glide_sync_queue')
      .select('*')
      .eq('operation', 'DELETE')
      .is('processed_at', null)
      .order('created_at', { ascending: true });

    if (deletionError) {
      console.error('Error fetching pending deletions:', deletionError);
      throw deletionError;
    }

    // Process deletions first
    const deletionResults = {
      processed: 0,
      errors: [] as string[]
    };

    if (pendingDeletions && pendingDeletions.length > 0) {
      console.log(`Found ${pendingDeletions.length} pending deletions`);
      for (const deletion of pendingDeletions) {
        try {
          await queueProcessor.processQueueItem(deletion, deletionResults);
        } catch (error) {
          console.error(`Error processing deletion ${deletion.id}:`, error);
          deletionResults.errors.push(`Failed to delete ${deletion.id}: ${error.message}`);
        }
      }
    }

    // Then process other sync operations in batches
    console.log('Processing other sync operations...');
    const result = {
      added: 0,
      updated: 0,
      deleted: deletionResults.processed,
      errors: [...deletionResults.errors]
    };

    let hasMoreItems = true;
    let processedCount = 0;

    while (hasMoreItems) {
      const { data: queueItems, error: queueError } = await supabase
        .from('glide_sync_queue')
        .select('*')
        .neq('operation', 'DELETE')
        .is('processed_at', null)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(BATCH_SIZE);

      if (queueError) {
        console.error('Error fetching queue items:', queueError);
        throw queueError;
      }

      if (!queueItems || queueItems.length === 0) {
        hasMoreItems = false;
        continue;
      }

      console.log(`Processing batch of ${queueItems.length} items`);
      
      // Process items in parallel within the batch
      await Promise.all(queueItems.map(item => queueProcessor.processQueueItem(item, result)));
      
      processedCount += queueItems.length;
      console.log(`Processed ${processedCount} items so far`);
      
      // Check if we need to continue processing more batches
      hasMoreItems = queueItems.length === BATCH_SIZE;
    }

    // Clean up processed queue items older than 24 hours
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    await supabase
      .from('glide_sync_queue')
      .delete()
      .lt('processed_at', twentyFourHoursAgo.toISOString());

    // Update health check status
    await supabase
      .from('sync_health_checks')
      .insert({
        check_type: 'sync_complete',
        status: result.errors.length > 0 ? 'warning' : 'success',
        details: { 
          correlation_id: correlationId,
          result,
          total_processed: processedCount
        }
      });

    console.log('Sync process completed:', result);
    logger.log({
      operation: 'sync_complete',
      status: 'success',
      details: result
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: result,
        correlationId
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
    console.error('Sync process failed:', error);
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    await supabase
      .from('sync_health_checks')
      .insert({
        check_type: 'sync_error',
        status: 'error',
        details: { 
          correlation_id: correlationId,
          error: error.message,
          stack: error.stack
        }
      });

    logger.log({
      operation: 'sync_failed',
      status: 'error',
      errorType: SyncErrorType.UNKNOWN,
      details: { 
        error: error.message,
        stack: error.stack
      }
    });
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        correlationId
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