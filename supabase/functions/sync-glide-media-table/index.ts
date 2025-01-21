import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { GlideConfig, SyncResult } from './types.ts';
import { mapGlideToSupabase, mapSupabaseToGlide } from './productMapper.ts';

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
    
    const { operation, tableId } = body;
    console.log('Received sync request:', { operation, tableId });
    
    if (!operation || !tableId) {
      throw new Error('Missing required parameters: operation and tableId');
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
      supabase_table_name: glideConfig.supabase_table_name
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

    if (operation === 'syncBidirectional') {
      console.log('Starting bidirectional sync');
      
      // Get all rows from Glide
      const glideResponse = await fetch(
        `https://api.glideapp.io/api/tables/${glideConfig.table_id}/rows`,
        { headers: glideHeaders }
      );

      if (!glideResponse.ok) {
        throw new Error(`Failed to fetch Glide data: ${await glideResponse.text()}`);
      }

      const glideRows = await glideResponse.json();
      
      // Get all rows from Supabase
      const { data: supabaseRows, error: supabaseError } = await supabase
        .from(glideConfig.supabase_table_name)
        .select('*');

      if (supabaseError) {
        console.error('Failed to fetch Supabase rows:', supabaseError);
        throw new Error(`Failed to fetch Supabase rows: ${supabaseError.message}`);
      }

      console.log('Fetched rows:', {
        glideCount: glideRows.length,
        supabaseCount: supabaseRows?.length
      });

      // Create maps for easy lookup
      const glideMap = new Map(glideRows.map(row => [row.id, row]));
      const supabaseMap = new Map(supabaseRows?.map(row => [row.id, row]) || []);

      // Sync Supabase -> Glide
      for (const [id, supabaseRow] of supabaseMap) {
        try {
          const mappedRow = mapSupabaseToGlide(supabaseRow);
          
          if (!glideMap.has(id)) {
            // Create new row in Glide
            const response = await fetch(
              `https://api.glideapp.io/api/tables/${glideConfig.table_id}/rows`,
              {
                method: 'POST',
                headers: glideHeaders,
                body: JSON.stringify(mappedRow)
              }
            );
            
            if (!response.ok) {
              throw new Error(`Failed to create Glide row: ${await response.text()}`);
            }
            
            result.added++;
            console.log('Added new row to Glide:', id);
          } else {
            const glideRow = glideMap.get(id)!;
            if (new Date(supabaseRow.updated_at) > new Date(glideRow.updatedAt)) {
              // Update existing row in Glide
              const response = await fetch(
                `https://api.glideapp.io/api/tables/${glideConfig.table_id}/rows/${id}`,
                {
                  method: 'PATCH',
                  headers: glideHeaders,
                  body: JSON.stringify(mappedRow)
                }
              );
              
              if (!response.ok) {
                throw new Error(`Failed to update Glide row: ${await response.text()}`);
              }
              
              result.updated++;
              console.log('Updated row in Glide:', id);
            }
          }
        } catch (error) {
          console.error('Error syncing to Glide:', error);
          result.errors.push(`Error syncing to Glide: ${error.message}`);
        }
      }

      // Sync Glide -> Supabase
      for (const [id, glideRow] of glideMap) {
        try {
          const supabaseRow = supabaseMap.get(id);
          const mappedRow = mapGlideToSupabase(glideRow);
          
          if (!supabaseRow) {
            const { error: insertError } = await supabase
              .from(glideConfig.supabase_table_name)
              .insert([mappedRow]);

            if (insertError) throw insertError;
            result.added++;
            console.log('Added new row to Supabase:', id);
          } else {
            const glideUpdatedAt = new Date(glideRow.updatedAt);
            const supabaseUpdatedAt = new Date(supabaseRow.updated_at);

            if (glideUpdatedAt > supabaseUpdatedAt) {
              const { error: updateError } = await supabase
                .from(glideConfig.supabase_table_name)
                .update(mappedRow)
                .eq('id', id);

              if (updateError) throw updateError;
              result.updated++;
              console.log('Updated row in Supabase:', id);
            }
          }
        } catch (error) {
          console.error('Error syncing from Glide:', error);
          result.errors.push(`Error syncing from Glide: ${error.message}`);
        }
      }
    } else {
      throw new Error(`Invalid operation: ${operation}`);
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