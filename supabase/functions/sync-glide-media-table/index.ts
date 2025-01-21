import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tableId } = await req.json();
    console.log('Starting sync with tableId:', tableId);

    if (!tableId) {
      throw new Error('Missing required parameter: tableId');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get Glide configuration
    const { data: glideConfig, error: configError } = await supabase
      .from('glide_config')
      .select('*')
      .eq('id', tableId)
      .single();

    if (configError || !glideConfig) {
      console.error('Failed to fetch Glide configuration:', configError);
      throw new Error(`Failed to fetch Glide configuration: ${configError?.message || 'Configuration not found'}`);
    }

    console.log('Found Glide configuration:', {
      table_name: glideConfig.table_name,
      table_id: glideConfig.table_id
    });

    // Fetch data from Glide
    const glideResponse = await fetch(
      `https://api.glideapp.io/api/tables/${glideConfig.table_id}/rows`, 
      {
        headers: {
          'Authorization': `Bearer ${glideConfig.api_token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    if (!glideResponse.ok) {
      const errorText = await glideResponse.text();
      console.error('Glide API error:', {
        status: glideResponse.status,
        statusText: glideResponse.statusText,
        error: errorText
      });
      throw new Error(`Failed to fetch Glide data: ${errorText}`);
    }

    const glideData = await glideResponse.json();
    console.log(`Fetched ${glideData.length} rows from Glide`);

    let updated = 0;
    const errors = [];

    // Update telegram_media records with Glide data
    for (const glideRow of glideData) {
      try {
        if (!glideRow.id) continue; // Skip rows without ID

        const { error: updateError } = await supabase
          .from('telegram_media')
          .update({ 
            glide_data: glideRow,
            last_synced_at: new Date().toISOString()
          })
          .eq('id', glideRow.id);

        if (updateError) {
          console.error('Error updating record:', updateError);
          errors.push(`Failed to update record ${glideRow.id}: ${updateError.message}`);
        } else {
          updated++;
        }
      } catch (error) {
        console.error('Error processing row:', error);
        errors.push(`Error processing row: ${error.message}`);
      }
    }

    console.log('Sync completed:', { updated, errors });

    return new Response(
      JSON.stringify({
        success: true,
        data: { updated, errors }
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