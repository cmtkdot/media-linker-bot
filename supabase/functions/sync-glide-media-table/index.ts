import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { GlideTableSchema, SyncResult, GlideResponse, GlideSyncQueueItem } from './types.ts';
import { mapSupabaseToGlide, mapGlideToSupabase } from './productMapper.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      headers: corsHeaders
    });
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

    // Process queue items
    const { data: queueItems, error: queueError } = await supabase
      .from('glide_sync_queue')
      .select('*')
      .eq('table_name', config.supabase_table_name)
      .is('processed_at', null)
      .order('created_at');

    if (queueError) throw queueError;

    console.log(`Found ${queueItems?.length || 0} pending sync items`);

    for (const item of queueItems || []) {
      try {
        let columnValues: Record<string, any> = {};
        let rowID = item.operation === 'INSERT' ? undefined : 
                   item.operation === 'UPDATE' ? item.new_data?.telegram_media_row_id :
                   item.old_data?.telegram_media_row_id;

        // Map data according to operation type
        if (item.operation !== 'DELETE') {
          const data = item.operation === 'UPDATE' ? item.new_data : item.new_data;
          columnValues = mapSupabaseToGlide(data);
        }

        const response = await fetch('https://api.glideapp.io/api/function/mutateTables', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.api_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            appID: config.app_id,
            mutations: [{
              kind: item.operation === 'DELETE' ? 'delete-row' : 
                     item.operation === 'UPDATE' ? 'set-columns-in-row' : 
                     'add-row-to-table',
              tableName: config.table_id,
              ...(item.operation !== 'DELETE' && { columnValues }),
              ...(rowID && { rowID })
            }]
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Glide API error: ${response.status} ${errorText}`);
        }

        const responseData = await response.json() as GlideResponse;
        
        // Store Glide rowID for new records
        if (item.operation === 'INSERT' && responseData.rowIDs?.[0]) {
          const newRowID = responseData.rowIDs[0];
          await supabase
            .from(config.supabase_table_name)
            .update({ 
              telegram_media_row_id: newRowID,
              glide_data: columnValues,
              last_synced_at: new Date().toISOString()
            })
            .eq('id', item.new_data.id);

          console.log('Updated telegram_media_row_id:', {
            record_id: item.new_data.id,
            glide_row_id: newRowID
          });
        } else if (item.operation === 'UPDATE') {
          await supabase
            .from(config.supabase_table_name)
            .update({ 
              glide_data: columnValues,
              last_synced_at: new Date().toISOString()
            })
            .eq('id', item.new_data.id);
        }

        // Mark queue item as processed
        await supabase
          .from('glide_sync_queue')
          .update({
            processed_at: new Date().toISOString(),
            error: null
          })
          .eq('id', item.id);

        // Update sync result counters
        if (item.operation === 'INSERT') result.added++;
        else if (item.operation === 'UPDATE') result.updated++;
        else if (item.operation === 'DELETE') result.deleted++;

      } catch (error) {
        console.error('Error processing queue item:', {
          item_id: item.id,
          error: error.message,
          stack: error.stack
        });

        result.errors.push(`Error processing ${item.id}: ${error.message}`);

        // Update queue item with error
        await supabase
          .from('glide_sync_queue')
          .update({
            error: error.message,
            retry_count: (item.retry_count || 0) + 1
          })
          .eq('id', item.id);
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