import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from './cors.ts';
import { fetchGlideRecords, createGlideRecord, updateGlideRecord } from './glideApi.ts';
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

    // Get all telegram_media records from Supabase
    const { data: supabaseRows, error: fetchError } = await supabase
      .from(config.supabase_table_name)
      .select('*');

    if (fetchError) throw fetchError;

    // Get records from Glide
    const glideData = await fetchGlideRecords(config.table_id);
    console.log('Fetched records - Supabase:', supabaseRows.length, 'Glide:', glideData.length);

    const result: SyncResult = {
      added: 0,
      updated: 0,
      deleted: 0,
      errors: []
    };

    // Create a map of existing Glide records by telegram_media_row_id
    const glideRecordsMap = new Map(
      glideData.map(record => [record.telegram_media_row_id, record])
    );

    // Process Supabase records
    for (const supabaseRecord of supabaseRows) {
      try {
        const glideRecord = glideRecordsMap.get(supabaseRecord.id);
        const recordData = {
          telegram_media_row_id: supabaseRecord.id,
          file_id: supabaseRecord.file_id,
          file_type: supabaseRecord.file_type,
          caption: supabaseRecord.caption,
          product_name: supabaseRecord.product_name,
          product_code: supabaseRecord.product_code,
          quantity: supabaseRecord.quantity,
          vendor_uid: supabaseRecord.vendor_uid,
          purchase_date: supabaseRecord.purchase_date,
          notes: supabaseRecord.notes,
          public_url: supabaseRecord.public_url || supabaseRecord.default_public_url,
        };

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

    // Process Glide records that don't exist in Supabase
    const supabaseIds = new Set(supabaseRows.map(row => row.id));
    const glideOnlyRecords = glideData.filter(
      record => record.telegram_media_row_id && !supabaseIds.has(record.telegram_media_row_id)
    );

    // Update Supabase with any new data from Glide
    for (const glideRecord of glideOnlyRecords) {
      try {
        const { error: updateError } = await supabase
          .from(config.supabase_table_name)
          .update({
            caption: glideRecord.caption,
            product_name: glideRecord.product_name,
            product_code: glideRecord.product_code,
            quantity: glideRecord.quantity,
            vendor_uid: glideRecord.vendor_uid,
            purchase_date: glideRecord.purchase_date,
            notes: glideRecord.notes,
            last_synced_at: new Date().toISOString()
          })
          .eq('id', glideRecord.telegram_media_row_id);

        if (updateError) throw updateError;
        result.updated++;
      } catch (error) {
        console.error('Error updating Supabase from Glide:', {
          record_id: glideRecord.telegram_media_row_id,
          error: error.message,
          stack: error.stack
        });
        result.errors.push(`Error updating Supabase record ${glideRecord.telegram_media_row_id}: ${error.message}`);
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