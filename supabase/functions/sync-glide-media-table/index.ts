import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { GlideConfig, SyncResult } from './types.ts';

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
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }

  try {
    console.log('Starting sync operation...');
    
    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch (error) {
      console.error('Error parsing request body:', error);
      throw new Error('Invalid request body');
    }
    
    const { tableId } = body;
    console.log('Received sync request:', { tableId });
    
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
      .maybeSingle();

    if (configError || !glideConfig) {
      console.error('Failed to fetch Glide configuration:', configError);
      throw new Error(`Failed to fetch Glide configuration: ${configError?.message || 'Configuration not found'}`);
    }

    console.log('Found Glide configuration:', { 
      table_name: glideConfig.table_name,
      table_id: glideConfig.table_id
    });

    // Initialize Glide API client
    const glideHeaders = {
      'Authorization': `Bearer ${glideConfig.api_token}`,
      'Content-Type': 'application/json',
    };

    let result: SyncResult = {
      added: 0,
      updated: 0,
      deleted: 0,
      errors: []
    };

    // Get all rows from Glide
    const glideResponse = await fetch(
      `https://api.glideapp.io/api/tables/${glideConfig.table_id}/rows`,
      { headers: glideHeaders }
    );

    if (!glideResponse.ok) {
      throw new Error(`Failed to fetch Glide data: ${await glideResponse.text()}`);
    }

    const glideRows = await glideResponse.json();
    
    // Get all rows from telegram_media
    const { data: telegramMedia, error: telegramError } = await supabase
      .from('telegram_media')
      .select('*');

    if (telegramError) {
      console.error('Failed to fetch telegram_media rows:', telegramError);
      throw new Error(`Failed to fetch telegram_media rows: ${telegramError.message}`);
    }

    console.log('Fetched rows:', {
      glideCount: glideRows.length,
      telegramMediaCount: telegramMedia?.length
    });

    // Create maps for easy lookup
    const glideMap = new Map(glideRows.map(row => [row.id, row]));
    const telegramMap = new Map(telegramMedia?.map(row => [row.id, row]) || []);

    // Update telegram_media with Glide data
    for (const [id, glideRow] of glideMap) {
      try {
        const telegramRow = telegramMap.get(id);
        
        // Map Glide data to telegram_media format
        const mappedData = {
          glide_data: glideRow,
          last_synced_at: new Date().toISOString()
        };
        
        if (!telegramRow) {
          // Skip creation of new records - we only update existing ones
          continue;
        } else {
          const glideUpdatedAt = new Date(glideRow.updatedAt);
          const telegramUpdatedAt = new Date(telegramRow.updated_at);

          if (glideUpdatedAt > telegramUpdatedAt) {
            const { error: updateError } = await supabase
              .from('telegram_media')
              .update(mappedData)
              .eq('id', id);

            if (updateError) throw updateError;
            result.updated++;
            console.log('Updated telegram_media row:', id);
          }
        }
      } catch (error) {
        console.error('Error syncing from Glide:', error);
        result.errors.push(`Error syncing from Glide: ${error.message}`);
      }
    }

    console.log('Sync completed successfully:', result);

    return new Response(
      JSON.stringify({ success: true, data: result }),
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