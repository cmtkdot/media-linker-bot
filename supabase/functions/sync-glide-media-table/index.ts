import { serve } from "https://deno.land/std@0.131.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GlideAPI } from "./glideApi.ts";
import { mapSupabaseToGlide, mapGlideToSupabase } from "./productMapper.ts";
import type { GlideSyncQueueItem, TelegramMedia } from "./types.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { operation, tableId, recordIds } = await req.json();

    console.log('Received sync request:', { operation, tableId, recordIds });

    if (!operation) {
      throw new Error('Operation is required');
    }

    if (operation === 'syncBidirectional') {
      // Get the Glide configuration
      const { data: config, error: configError } = await supabase
        .from('glide_config')
        .select('*')
        .eq('id', tableId)
        .single();

      if (configError) {
        throw configError;
      }

      if (!config.active || !config.supabase_table_name) {
        throw new Error('Glide configuration is not active or table is not linked');
      }

      console.log('Found config:', config);

      // Initialize Glide API client
      const glideApi = new GlideAPI(
        config.app_id,
        config.table_id,
        config.api_token,
        supabase
      );

      // Get records to sync
      let query = supabase
        .from('telegram_media')
        .select('*');

      // If specific records are requested, filter for those
      if (recordIds && recordIds.length > 0) {
        query = query.in('id', recordIds);
      }

      const { data: records, error: recordsError } = await query;

      if (recordsError) {
        throw recordsError;
      }

      console.log(`Found ${records?.length || 0} records to sync`);

      let added = 0;
      let updated = 0;
      let deleted = 0;
      const errors: string[] = [];

      // Process each record
      for (const record of records || []) {
        try {
          // Map Supabase data to Glide format
          const glideData = mapSupabaseToGlide(record);

          // If record has a Glide row ID, update it
          if (record.telegram_media_row_id) {
            await glideApi.updateRow(record.telegram_media_row_id, glideData);
            updated++;
          } else {
            // Otherwise create a new row
            await glideApi.addRow(glideData, record.id);
            added++;
          }

          // Update last_synced_at
          await supabase
            .from('telegram_media')
            .update({ last_synced_at: new Date().toISOString() })
            .eq('id', record.id);

        } catch (error) {
          console.error('Error processing record:', error);
          errors.push(`Error processing record ${record.id}: ${error.message}`);
        }
      }

      // Process sync queue for changes from Glide
      const { data: queueItems, error: queueError } = await supabase
        .from('glide_sync_queue')
        .select('*')
        .is('processed_at', null)
        .order('created_at', { ascending: true });

      if (queueError) {
        throw queueError;
      }

      console.log(`Found ${queueItems?.length || 0} queue items to process`);

      // Process each queue item
      for (const item of queueItems || []) {
        try {
          switch (item.operation) {
            case 'INSERT':
            case 'UPDATE':
              if (item.new_data) {
                const supabaseData = mapGlideToSupabase(item.new_data);
                await supabase
                  .from('telegram_media')
                  .upsert(supabaseData)
                  .eq('id', item.record_id);
              }
              break;
            case 'DELETE':
              await supabase
                .from('telegram_media')
                .delete()
                .eq('id', item.record_id);
              deleted++;
              break;
          }

          // Mark as processed
          await supabase
            .from('glide_sync_queue')
            .update({ 
              processed_at: new Date().toISOString(),
              error: null 
            })
            .eq('id', item.id);

        } catch (error) {
          console.error('Error processing queue item:', error);
          errors.push(`Error processing queue item ${item.id}: ${error.message}`);

          // Update error count
          await supabase
            .from('glide_sync_queue')
            .update({ 
              error: error.message,
              retry_count: (item.retry_count || 0) + 1
            })
            .eq('id', item.id);
        }
      }

      const response = {
        success: true,
        data: {
          added,
          updated,
          deleted,
          errors
        },
        stats: {
          processedItems: (records?.length || 0) + (queueItems?.length || 0),
          skippedItems: 0,
          errorItems: errors.length,
          totalTime: 0,
          details: {}
        }
      };

      console.log('Sync completed:', response);

      return new Response(
        JSON.stringify(response),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    throw new Error(`Unknown operation: ${operation}`);

  } catch (error) {
    console.error('Error in sync function:', error);
    
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
