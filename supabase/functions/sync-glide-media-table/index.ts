import { serve } from "https://deno.land/std@0.131.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GlideAPI } from "./glideApi.ts";
import { QueueProcessor } from "./queueProcessor.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createSyncLogger, SyncErrorType } from "../_shared/sync-logger.ts";
import { v4 as uuidv4 } from 'https://esm.sh/uuid@9.0.0';

const BATCH_SIZE = 10;
const MAX_RETRIES = 3;

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
    logger.log({
      operation: 'sync_start',
      status: 'success',
      details: { method: req.method }
    });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get active Glide configurations
    const { data: configs, error: configError } = await supabase
      .from('glide_config')
      .select('*')
      .eq('active', true);

    if (configError) {
      logger.log({
        operation: 'fetch_config',
        status: 'error',
        errorType: SyncErrorType.DATABASE,
        details: { error: configError }
      });
      throw configError;
    }

    if (!configs || configs.length === 0) {
      logger.log({
        operation: 'validate_config',
        status: 'error',
        errorType: SyncErrorType.VALIDATION,
        details: { message: 'No active configuration found' }
      });
      throw new Error('No active Glide configuration found');
    }

    const config = configs[0];
    logger.log({
      operation: 'config_loaded',
      status: 'success',
      details: { config_id: config.id }
    });

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
    const queueProcessor = new QueueProcessor(supabase, config, glideApi, logger);

    // Get unprocessed items from queue
    const { data: queueItems, error: queueError } = await supabase
      .from('glide_sync_queue')
      .select('*')
      .is('processed_at', null)
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (queueError) {
      logger.log({
        operation: 'fetch_queue',
        status: 'error',
        errorType: SyncErrorType.DATABASE,
        details: { error: queueError }
      });
      throw queueError;
    }

    logger.log({
      operation: 'queue_fetched',
      status: 'success',
      details: { items_count: queueItems?.length || 0 }
    });

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
        logger.log({
          operation: 'process_item',
          status: 'error',
          errorType: SyncErrorType.UNKNOWN,
          details: { 
            item_id: item.id,
            error: error.message 
          }
        });
        result.errors.push(`Error processing item ${item.id}: ${error.message}`);
      }
    }

    // Clean up processed items older than 24 hours
    const { error: cleanupError } = await supabase
      .from('glide_sync_queue')
      .delete()
      .lt('processed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (cleanupError) {
      logger.log({
        operation: 'cleanup',
        status: 'error',
        errorType: SyncErrorType.DATABASE,
        details: { error: cleanupError }
      });
    }

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