import { serve } from "https://deno.land/std@0.131.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { createSyncLogger, SyncErrorType } from "../_shared/sync-logger.ts";

serve(async (req: Request) => {
  const logger = createSyncLogger(crypto.randomUUID());
  
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { operation, tableId, recordIds } = await req.json();

    logger.log({
      operation: 'sync_to_glide',
      status: 'started',
      details: { operation, tableId, recordCount: recordIds?.length }
    });

    // Get the Glide configuration
    const { data: config, error: configError } = await supabase
      .from('glide_config')
      .select('*')
      .eq('id', tableId)
      .single();

    if (configError) {
      logger.log({
        operation: 'get_glide_config',
        status: 'error',
        errorType: SyncErrorType.DATABASE,
        details: { error: configError.message }
      });
      throw configError;
    }

    // Check for updates in telegram_media
    const { data: updates, error: updateCheckError } = await supabase
      .from('telegram_media')
      .select('*')
      .in('id', recordIds || []);

    if (updateCheckError) {
      logger.log({
        operation: 'check_updates',
        status: 'error',
        errorType: SyncErrorType.DATABASE,
        details: { error: updateCheckError.message }
      });
      throw updateCheckError;
    }

    if (!updates || updates.length === 0) {
      logger.log({
        operation: 'check_updates',
        status: 'complete',
        details: { message: 'No updates found' }
      });
      
      return new Response(
        JSON.stringify({ message: 'No updates found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logger.log({
      operation: 'process_updates',
      status: 'processing',
      details: { updateCount: updates.length }
    });

    // Process updates to Glide
    const results = {
      processed: 0,
      errors: [] as string[]
    };

    for (const update of updates) {
      try {
        // Call Glide API to sync record
        // Implementation depends on your Glide API structure
        results.processed++;
        
        logger.log({
          operation: 'sync_record',
          status: 'success',
          details: { record_id: update.id }
        });
      } catch (error) {
        logger.log({
          operation: 'sync_record',
          status: 'error',
          errorType: SyncErrorType.API,
          details: {
            error: error.message,
            record_id: update.id
          }
        });
        
        results.errors.push(`Error syncing record ${update.id}: ${error.message}`);
      }
    }

    logger.log({
      operation: 'sync_to_glide',
      status: 'complete',
      details: {
        processed: results.processed,
        errors: results.errors.length
      }
    });

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logger.log({
      operation: 'sync_to_glide',
      status: 'error',
      errorType: SyncErrorType.UNKNOWN,
      details: { error: error.message }
    });
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});