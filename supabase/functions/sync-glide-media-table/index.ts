import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { GlideAPI } from './glideApi.ts';
import { corsHeaders } from './cors.ts';
import { mapSupabaseToGlide, mapGlideToSupabase } from './productMapper.ts';
import type { SyncResult, GlideConfig, GlideSyncQueueItem } from '../_shared/types.ts';

serve(async (req) => {
  console.log('Received request:', req.method, req.url);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      headers: corsHeaders,
      status: 204
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
          headers: corsHeaders
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
          headers: corsHeaders
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
    
    // Process each queue item
    for (const item of queueItems || []) {
      try {
        switch (item.operation) {
          case 'INSERT': {
            if (!item.new_data) {
              throw new Error('No new data provided for INSERT operation');
            }

            const mappedData = mapSupabaseToGlide(item.new_data);
            const response = await glideApi.addRow(mappedData);
            console.log('Glide API response:', response);

            if (response.rowIDs?.[0]) {
              // Update the telegram_media record with the new row ID
              const { error: updateError } = await supabase
                .from(config.supabase_table_name)
                .update({ 
                  telegram_media_row_id: response.rowIDs[0],
                  last_synced_at: new Date().toISOString()
                })
                .eq('id', item.new_data.id);

              if (updateError) throw updateError;
              result.added++;
              console.log('Successfully added row and updated telegram_media_row_id:', response.rowIDs[0]);
            } else {
              throw new Error('No row ID returned from Glide API');
            }
            break;
          }

          case 'UPDATE': {
            if (!item.new_data?.telegram_media_row_id) {
              throw new Error('No Glide row ID found for UPDATE operation');
            }

            const mappedData = mapSupabaseToGlide(item.new_data);
            const response = await glideApi.updateRow(item.new_data.telegram_media_row_id, mappedData);
            console.log('Glide API update response:', response);

            // Update last_synced_at in Supabase
            const { error: updateError } = await supabase
              .from(config.supabase_table_name)
              .update({ last_synced_at: new Date().toISOString() })
              .eq('id', item.new_data.id);

            if (updateError) throw updateError;
            result.updated++;
            console.log('Successfully updated row in Glide');
            break;
          }

          case 'DELETE': {
            if (!item.old_data?.telegram_media_row_id) {
              throw new Error('No Glide row ID found for DELETE operation');
            }

            const response = await glideApi.deleteRow(item.old_data.telegram_media_row_id);
            console.log('Glide API delete response:', response);
            result.deleted++;
            console.log('Successfully deleted row from Glide');
            break;
          }

          default:
            throw new Error(`Unknown operation: ${item.operation}`);
        }

      } catch (error) {
        console.error('Error processing queue item:', {
          item_id: item.id,
          error: error.message,
          stack: error.stack
        });
        result.errors.push(`Error processing item ${item.id}: ${error.message}`);
      }
    }

    console.log('Sync completed:', result);

    return new Response(
      JSON.stringify({
        success: true,
        data: result
      }),
      { headers: corsHeaders }
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
        headers: corsHeaders
      }
    );
  }
});
