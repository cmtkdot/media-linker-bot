import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from './cors.ts';
import { fetchGlideRecords, createGlideRecord, updateGlideRecord } from './glideApi.ts';
import { mapGlideToSupabase, mapSupabaseToGlide } from './productMapper.ts';
import type { SyncResult, GlideConfig } from './types.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
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

    // Process any pending items in the sync queue first
    const { data: queueItems, error: queueError } = await supabase
      .from('glide_sync_queue')
      .select('*')
      .is('processed_at', null)
      .eq('table_name', config.supabase_table_name)
      .order('created_at', { ascending: true });

    if (queueError) throw queueError;

    console.log(`Found ${queueItems?.length || 0} pending sync items`);

    const result: SyncResult = {
      added: 0,
      updated: 0,
      deleted: 0,
      errors: []
    };

    // Process queue items
    for (const item of queueItems || []) {
      try {
        switch (item.operation) {
          case 'INSERT':
          case 'UPDATE':
            const recordData = item.new_data;
            if (!recordData) continue;

            const glideData = mapSupabaseToGlide(recordData);
            
            if (item.operation === 'INSERT') {
              await createGlideRecord(config.table_id, glideData);
              result.added++;
            } else {
              const glideId = recordData.telegram_media_row_id;
              if (glideId) {
                await updateGlideRecord(config.table_id, glideId, glideData);
                result.updated++;
              }
            }
            break;

          case 'DELETE':
            // Handle deletion if needed
            // Note: Current implementation doesn't delete records from Glide
            break;
        }

        // Mark queue item as processed
        await supabase
          .from('glide_sync_queue')
          .update({
            processed_at: new Date().toISOString(),
            error: null
          })
          .eq('id', item.id);

      } catch (error) {
        console.error('Error processing queue item:', {
          item_id: item.id,
          error: error.message,
          stack: error.stack
        });

        // Update queue item with error
        await supabase
          .from('glide_sync_queue')
          .update({
            error: error.message,
            retry_count: (item.retry_count || 0) + 1
          })
          .eq('id', item.id);

        result.errors.push(`Error processing ${item.id}: ${error.message}`);
      }
    }

    // Now perform full sync with Glide
    const { data: supabaseRows, error: fetchError } = await supabase
      .from(config.supabase_table_name)
      .select('*');

    if (fetchError) throw fetchError;

    // Get records from Glide
    const glideData = await fetchGlideRecords(config.table_id);
    console.log('Fetched records - Supabase:', supabaseRows.length, 'Glide:', glideData.length);

    // Create a map of existing Glide records by telegram_media_row_id
    const glideRecordsMap = new Map(
      glideData.map(record => [record.telegram_media_row_id, record])
    );

    // Process Supabase records
    for (const supabaseRecord of supabaseRows) {
      try {
        const glideRecord = glideRecordsMap.get(supabaseRecord.id);
        const recordData = mapSupabaseToGlide(supabaseRecord);

        if (!glideRecord) {
          await createGlideRecord(config.table_id, recordData);
          result.added++;
          console.log('Created new record in Glide:', supabaseRecord.id);
        } else {
          // Check if update is needed by comparing values
          const needsUpdate = Object.entries(recordData).some(
            ([key, value]) => glideRecord[key] !== value
          );

          if (needsUpdate) {
            await updateGlideRecord(config.table_id, glideRecord.id, recordData);
            result.updated++;
            console.log('Updated record in Glide:', supabaseRecord.id);
          }
        }

        // Update last_synced_at in Supabase
        await supabase
          .from(config.supabase_table_name)
          .update({ 
            last_synced_at: new Date().toISOString(),
            telegram_media_row_id: supabaseRecord.id 
          })
          .eq('id', supabaseRecord.id);

      } catch (error) {
        console.error('Error processing record:', {
          record_id: supabaseRecord.id,
          error: error.message,
          stack: error.stack
        });
        result.errors.push(`Error processing ${supabaseRecord.id}: ${error.message}`);
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
          'Content-Type': 'application/json; charset=utf-8'
        }
      }
    );

  } catch (error) {
    console.error('Error in sync operation:', {
      error: error.message,
      stack: error.stack
    });
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json; charset=utf-8'
        }
      }
    );
  }
});