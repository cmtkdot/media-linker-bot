import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';
import { GlideConfig, SyncResult } from './types.ts';

const GLIDE_API_BASE = 'https://api.glideapp.io/api/function';

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const glideApiToken = Deno.env.get('GLIDE_API_TOKEN');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    if (!glideApiToken) {
      throw new Error('Missing Glide API token');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { operation, tableId } = await req.json();

    if (!operation || !tableId) {
      throw new Error('Missing required parameters');
    }

    // Get the glide config for the specified table
    const { data: config, error: configError } = await supabase
      .from('glide_config')
      .select('*')
      .eq('id', tableId)
      .single();

    if (configError) throw configError;
    if (!config) throw new Error('Configuration not found');
    if (!config.supabase_table_name) throw new Error('No Supabase table linked');

    console.log('Starting sync with config:', {
      table_name: config.table_name,
      supabase_table_name: config.supabase_table_name,
    });

    const result: SyncResult = {
      added: 0,
      updated: 0,
      deleted: 0,
      errors: []
    };

    // Process pending queue items
    const { data: queueItems, error: queueError } = await supabase
      .from('glide_sync_queue')
      .select('*')
      .eq('table_name', config.supabase_table_name)
      .is('processed_at', null)
      .order('created_at');

    if (queueError) throw queueError;

    console.log(`Found ${queueItems?.length || 0} pending sync items`);

    // Process each queue item
    for (const item of queueItems || []) {
      try {
        const response = await fetch(`${GLIDE_API_BASE}/mutateTables`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${glideApiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            appID: config.app_id,
            mutations: [{
              kind: item.operation === 'DELETE' ? 'delete-row' : 
                     item.operation === 'UPDATE' ? 'set-columns-in-row' : 
                     'add-row-to-table',
              tableName: config.table_id,
              ...(item.operation !== 'DELETE' && {
                columnValues: mapSupabaseToGlideColumns(
                  item.operation === 'UPDATE' ? item.new_data : item.old_data
                )
              }),
              ...(item.operation !== 'INSERT' && { rowID: item.record_id })
            }]
          })
        });

        if (!response.ok) {
          throw new Error(`Glide API error: ${response.status} ${response.statusText}`);
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
          error: error.message
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

function mapSupabaseToGlideColumns(data: any) {
  return {
    'UkkMS': data.id,
    '9Bod8': data.file_id,
    'IYnip': data.file_unique_id,
    'hbjE4': data.file_type,
    'd8Di5': data.public_url,
    'xGGv3': data.product_name,
    'xlfB9': data.product_code,
    'TWRwx': data.quantity,
    'Wm1he': JSON.stringify(data.telegram_data),
    'ZRV7Z': JSON.stringify(data.glide_data),
    'Eu9Zn': JSON.stringify(data.media_metadata),
    'oj7fP': data.processed,
    'A4sZX': data.processing_error,
    'PWhCr': data.last_synced_at,
    'Oa3L9': data.created_at,
    '9xwrl': data.updated_at,
    'Uzkgt': data.message_id,
    'pRsjz': data.caption,
    'uxDo1': data.vendor_uid,
    'AMWxJ': data.purchase_date,
    'BkUFO': data.notes,
    'QhAgy': JSON.stringify(data.analyzed_content),
    '3y8Wt': data.purchase_order_uid,
    'rCJK2': data.default_public_url,
    'KmP9x': data.telegram_media_row_id
  };
}