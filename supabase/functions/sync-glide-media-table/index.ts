import { serve } from "https://deno.land/std@0.131.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GlideAPI } from "./glideApi.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createSyncLogger, SyncErrorType } from "../_shared/sync-logger.ts";
import { v4 as uuidv4 } from 'https://esm.sh/uuid@9.0.0';

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

    const { operation, record } = await req.json();

    if (operation === 'syncDirect' && record) {
      console.log('Processing direct sync for record:', record.id);
      
      try {
        if (!record.telegram_media_row_id) {
          // Create new record in Glide
          const response = await glideApi.addRow(record, record.id);
          
          // Update telegram_media with the new row ID
          await supabase
            .from('telegram_media')
            .update({ 
              telegram_media_row_id: response.rowID,
              last_synced_at: new Date().toISOString()
            })
            .eq('id', record.id);

          console.log('Successfully created record in Glide:', response.rowID);
        } else {
          // Update existing record in Glide
          await glideApi.updateRow(record.telegram_media_row_id, record);
          
          // Update last_synced_at in telegram_media
          await supabase
            .from('telegram_media')
            .update({ last_synced_at: new Date().toISOString() })
            .eq('id', record.id);

          console.log('Successfully updated record in Glide:', record.telegram_media_row_id);
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Record synced successfully',
            correlationId 
          }),
          { 
            headers: { 
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          }
        );
      } catch (error) {
        console.error('Error syncing record:', error);
        
        // Log error to failed_webhook_updates
        await supabase
          .from('failed_webhook_updates')
          .insert({
            message_id: record.telegram_data?.message_id,
            chat_id: record.telegram_data?.chat_id,
            error_message: error.message,
            error_stack: error.stack,
            message_data: record,
            status: 'failed'
          });

        throw error;
      }
    }

    return new Response(
      JSON.stringify({ 
        error: 'Invalid operation',
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

  } catch (error) {
    console.error('Sync process failed:', error);
    
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