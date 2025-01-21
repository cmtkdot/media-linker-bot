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
  deleted: number;
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

    // Get API token from Edge Function secrets
    const apiToken = Deno.env.get('GLIDE_API_TOKEN')?.trim();
    if (!apiToken) {
      throw new Error('GLIDE_API_TOKEN is not set in Edge Function secrets');
    }

    console.log('Starting sync with config:', {
      table_name: config.table_name,
      supabase_table_name: config.supabase_table_name,
      has_token: true,
      token_length: apiToken.length,
      token_preview: `${apiToken.substring(0, 5)}...${apiToken.substring(apiToken.length - 5)}`
    });

    // Get all telegram_media records from Supabase
    const { data: supabaseRows, error: fetchError } = await supabase
      .from(config.supabase_table_name)
      .select('*');

    if (fetchError) throw fetchError;

    // Make request to Glide API with proper authorization and UTF-8 encoding
    const glideResponse = await fetch(`https://api.glideapp.io/api/tables/${encodeURIComponent(config.table_id)}/rows`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json; charset=utf-8',
        'Accept': 'application/json; charset=utf-8',
      },
    });

    if (!glideResponse.ok) {
      const errorText = await glideResponse.text();
      const errorDetails = {
        status: glideResponse.status,
        statusText: glideResponse.statusText,
        error: errorText,
        config: {
          table_id: config.table_id,
          has_token: true,
          token_length: apiToken.length,
          auth_header_preview: `Bearer ${apiToken.substring(0, 5)}...${apiToken.substring(apiToken.length - 5)}`
        }
      };
      
      console.error('Glide API error:', errorDetails);
      
      // Provide more specific error messages based on status code
      let errorMessage = 'Glide API error';
      if (glideResponse.status === 401) {
        errorMessage = 'Invalid or expired Glide API token. Please check your Edge Function secrets.';
      } else if (glideResponse.status === 403) {
        errorMessage = 'Access forbidden. Please verify your Glide API permissions.';
      } else if (glideResponse.status === 404) {
        errorMessage = 'Glide table not found. Please verify your table ID.';
      }
      
      throw new Error(`${errorMessage}: ${JSON.stringify(errorDetails, null, 2)}`);
    }

    const glideData = await glideResponse.json() as GlideRecord[];
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
          'Content-Type': 'application/json'
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
