import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Use the API token from config or environment variable
    const apiToken = config.api_token || Deno.env.get('GLIDE_API_TOKEN');
    if (!apiToken) {
      throw new Error('No API token available');
    }

    // Get all telegram_media records from Supabase
    const { data: supabaseRows, error: fetchError } = await supabase
      .from('telegram_media')
      .select('*');

    if (fetchError) throw fetchError;

    let updated = 0;
    let added = 0;
    let errors = [];

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

    const glideData = await glideResponse.json();
    console.log('Glide API response:', glideData);

    console.log('Sync completed:', { updated, added, errors });

    return new Response(
      JSON.stringify({
        success: true,
        data: { updated, added, errors }
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