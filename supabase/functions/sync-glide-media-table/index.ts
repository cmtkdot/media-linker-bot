import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GlideRecord {
  id: string;
  [key: string]: any;
}

interface SyncResult {
  added: number;
  updated: number;
  errors: string[];
}

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

    // Get the request body
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

    // Use the API token from config or environment variable
    const apiToken = config.api_token || Deno.env.get('GLIDE_API_TOKEN');
    if (!apiToken) {
      throw new Error('No API token available');
    }

    // Get all telegram_media records from Supabase
    const { data: supabaseRows, error: fetchError } = await supabase
      .from(config.supabase_table_name)
      .select('*');

    if (fetchError) throw fetchError;

    // Make request to Glide API with the token
    const glideResponse = await fetch(`https://api.glideapp.io/api/tables/${config.table_id}/rows`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!glideResponse.ok) {
      const errorText = await glideResponse.text();
      throw new Error(`Glide API error: ${JSON.stringify({
        status: glideResponse.status,
        statusText: glideResponse.statusText,
        error: errorText
      }, null, 2)}`);
    }

    const glideData = await glideResponse.json() as GlideRecord[];
    console.log('Fetched records - Supabase:', supabaseRows.length, 'Glide:', glideData.length);

    const result: SyncResult = {
      added: 0,
      updated: 0,
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
          // Create new record in Glide
          const createResponse = await fetch(`https://api.glideapp.io/api/tables/${config.table_id}/rows`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify([recordData])
          });

          if (!createResponse.ok) {
            throw new Error(`Failed to create Glide record: ${await createResponse.text()}`);
          }

          result.added++;
          console.log('Created new record in Glide:', supabaseRecord.id);
        } else {
          // Check if update is needed by comparing values
          const needsUpdate = Object.entries(recordData).some(
            ([key, value]) => glideRecord[key] !== value
          );

          if (needsUpdate) {
            // Update existing record in Glide
            const updateResponse = await fetch(
              `https://api.glideapp.io/api/tables/${config.table_id}/rows/${glideRecord.id}`,
              {
                method: 'PATCH',
                headers: {
                  'Authorization': `Bearer ${apiToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(recordData)
              }
            );

            if (!updateResponse.ok) {
              throw new Error(`Failed to update Glide record: ${await updateResponse.text()}`);
            }

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
        console.error('Error processing record:', supabaseRecord.id, error);
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
        console.error('Error updating Supabase from Glide:', glideRecord.telegram_media_row_id, error);
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
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    console.error('Error in sync operation:', error);
    
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
          'Content-Type': 'application/json'
        }
      }
    );
  }
});