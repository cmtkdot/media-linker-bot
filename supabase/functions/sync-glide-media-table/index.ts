import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from '@supabase/supabase-js';
import { GlideClient } from '@glideapps/tables';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const GLIDE_API_TOKEN = Deno.env.get('GLIDE_API_TOKEN');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !GLIDE_API_TOKEN) {
      throw new Error('Missing required environment variables');
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Get request body
    const { operation, tableId } = await req.json();
    
    if (!operation || !tableId) {
      throw new Error('Missing required parameters: operation and tableId');
    }

    // Get Glide configuration for the specified table
    const { data: glideConfig, error: configError } = await supabase
      .from('glide_config')
      .select('*')
      .eq('id', tableId)
      .single();

    if (configError || !glideConfig) {
      throw new Error(`Failed to fetch Glide configuration: ${configError?.message || 'Configuration not found'}`);
    }

    // Initialize Glide client with the table-specific API token
    const glide = new GlideClient(glideConfig.api_token);
    const table = glide.table(glideConfig.table_id);

    console.log('Starting sync operation:', { operation, tableId });

    let result;
    switch (operation) {
      case 'syncBidirectional': {
        // Get all rows from both systems
        const [glideRows, { data: supabaseRows, error: supabaseError }] = await Promise.all([
          table.rows(),
          supabase.from('telegram_media').select('*')
        ]);

        if (supabaseError) {
          throw new Error(`Failed to fetch Supabase rows: ${supabaseError.message}`);
        }

        console.log('Fetched rows:', {
          glideCount: glideRows.length,
          supabaseCount: supabaseRows?.length
        });

        // Create maps for easy lookup
        const glideMap = new Map(glideRows.map(row => [row.get('id') as string, row]));
        const supabaseMap = new Map(supabaseRows?.map(row => [row.id, row]) || []);

        const syncResult = {
          added: 0,
          updated: 0,
          deleted: 0,
          errors: [] as string[]
        };

        // Sync Supabase -> Glide
        for (const [id, supabaseRow] of supabaseMap) {
          try {
            if (!glideMap.has(id)) {
              // New row in Supabase
              await table.addRow({
                id,
                file_id: supabaseRow.file_id,
                file_unique_id: supabaseRow.file_unique_id,
                file_type: supabaseRow.file_type,
                public_url: supabaseRow.public_url,
                caption: supabaseRow.caption,
                // Add other fields as needed
              });
              syncResult.added++;
            } else {
              // Update existing row
              const glideRow = glideMap.get(id)!;
              if (new Date(supabaseRow.updated_at) > new Date(glideRow.get('updated_at') as string)) {
                await table.updateRow(glideRow.rowId, {
                  file_id: supabaseRow.file_id,
                  file_unique_id: supabaseRow.file_unique_id,
                  file_type: supabaseRow.file_type,
                  public_url: supabaseRow.public_url,
                  caption: supabaseRow.caption,
                  // Add other fields as needed
                });
                syncResult.updated++;
              }
            }
          } catch (error) {
            console.error('Error syncing to Glide:', error);
            syncResult.errors.push(`Error syncing to Glide: ${error.message}`);
          }
        }

        result = syncResult;
        break;
      }
      default:
        throw new Error(`Invalid operation: ${operation}`);
    }

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