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

    // Initialize Glide API client
    const glideApi = new GlideAPI(
      config.app_id,
      config.table_id,
      config.api_token,
      supabase
    );

    // Initialize queue processor
    const queueProcessor = new QueueProcessor(supabase, config, glideApi, logger);

    // Check for differences between Supabase and Glide
    const { data: differences, error: diffError } = await supabase
      .rpc('check_telegram_media_differences');

    if (diffError) {
      logger.log({
        operation: 'check_differences',
        status: 'error',
        errorType: SyncErrorType.DATABASE,
        details: { error: diffError }
      });
    } else if (differences?.length > 0) {
      // Queue differences for sync
      const batchId = uuidv4();
      await Promise.all(differences.map(async (diff, index) => {
        await supabase
          .from('glide_sync_queue')
          .insert({
            table_name: 'telegram_media',
            record_id: diff.record_id,
            operation: diff.difference_type === 'missing_in_glide' ? 'INSERT' : 'UPDATE',
            new_data: diff.supabase_data,
            old_data: diff.glide_data,
            priority: 2, // Higher priority for differences
            batch_id: batchId
          });
      }));
    }

    // Get unprocessed items from queue, ordered by priority
    const { data: queueItems, error: queueError } = await supabase
      .from('glide_sync_queue')
      .select('*')
      .is('processed_at', null)
      .order('priority', { ascending: false })
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

    const result = {
      added: 0,
      updated: 0,
      deleted: 0,
      errors: [] as string[]
    };

    // Process queue items in batches
    const batches = queueItems?.reduce((acc, item) => {
      const batchId = item.batch_id || 'default';
      if (!acc[batchId]) {
        acc[batchId] = [];
      }
      acc[batchId].push(item);
      return acc;
    }, {} as Record<string, any[]>) || {};

    // Process each batch
    for (const [batchId, items] of Object.entries(batches)) {
      try {
        await Promise.all(items.map(item => queueProcessor.processQueueItem(item, result)));
      } catch (error) {
        logger.log({
          operation: 'process_batch',
          status: 'error',
          errorType: SyncErrorType.UNKNOWN,
          details: { 
            batch_id: batchId,
            error: error.message 
          }
        });
      }
    }

    // Update health check status
    await supabase
      .from('sync_health_checks')
      .insert({
        check_type: 'sync_complete',
        status: result.errors.length > 0 ? 'warning' : 'success',
        details: { 
          correlation_id: correlationId,
          result
        }
      });

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
    // Record error in health checks
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