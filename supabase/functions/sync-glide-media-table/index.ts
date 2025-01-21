import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { Table } from 'https://esm.sh/@glideapps/tables@1.0.5';
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
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting sync operation...');
    
    const { operation, tableId } = await req.json();
    console.log('Received sync request:', { operation, tableId });
    
    if (!operation || !tableId) {
      throw new Error('Missing required parameters: operation and tableId');
    }

    // Get Glide configuration
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
      supabase_table_name: glideConfig.supabase_table_name
    });

    // Initialize Glide table with proper configuration
    const table = new Table(glideConfig.api_token, glideConfig.table_id);
    
    // Test the connection by getting table info
    try {
      await table.getInfo();
      console.log('Successfully connected to Glide table');
    } catch (error) {
      console.error('Failed to connect to Glide table:', error);
      throw new Error(`Failed to connect to Glide table: ${error.message}`);
    }

    let result: SyncResult;
    switch (operation) {
      case 'syncBidirectional': {
        console.log('Starting bidirectional sync');
        
        // Get all rows from both systems
        const [glideRows, { data: supabaseRows, error: supabaseError }] = await Promise.all([
          table.getRows(),
          supabase.from(glideConfig.supabase_table_name).select('*')
        ]);

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

        const syncResult = {
          added: 0,
          updated: 0,
          deleted: 0,
          errors: [] as string[]
        };

        // Sync Supabase -> Glide
        for (const [id, supabaseRow] of supabaseMap) {
          try {
            const mappedRow = mapSupabaseToGlide(supabaseRow);
            if (!glideMap.has(id)) {
              // For new rows, we need to create them in Glide
              await table.addRow(mappedRow);
              syncResult.added++;
              console.log('Added new row to Glide:', id);
            } else {
              const glideRow = glideMap.get(id)!;
              // Only update if Supabase has newer data
              if (new Date(supabaseRow.updated_at) > new Date(glideRow.updatedAt)) {
                await table.updateRow(id, mappedRow);
                syncResult.updated++;
                console.log('Updated row in Glide:', id);
              }
            }
          } catch (error) {
            console.error('Error syncing to Glide:', error);
            syncResult.errors.push(`Error syncing to Glide: ${error.message}`);
          }
        }

        // Sync Glide -> Supabase
        for (const [id, glideRow] of glideMap) {
          try {
            const supabaseRow = supabaseMap.get(id);
            if (!supabaseRow) {
              // New row from Glide
              const mappedRow = mapGlideToSupabase(glideRow);
              const { error: insertError } = await supabase
                .from(glideConfig.supabase_table_name)
                .insert([mappedRow]);

              if (insertError) throw insertError;
              syncResult.added++;
              console.log('Added new row to Supabase:', id);
            } else {
              // Update existing row if Glide has newer data
              const glideUpdatedAt = new Date(glideRow.updatedAt);
              const supabaseUpdatedAt = new Date(supabaseRow.updated_at);

              if (glideUpdatedAt > supabaseUpdatedAt) {
                const mappedRow = mapGlideToSupabase(glideRow);
                const { error: updateError } = await supabase
                  .from(glideConfig.supabase_table_name)
                  .update(mappedRow)
                  .eq('id', id);

                if (updateError) throw updateError;
                syncResult.updated++;
                console.log('Updated row in Supabase:', id);
              }
            }
          } catch (error) {
            console.error('Error syncing from Glide:', error);
            syncResult.errors.push(`Error syncing from Glide: ${error.message}`);
          }
        }

        result = syncResult;
        break;
      }
      default:
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
        status: 400,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        }
      }
    );
  }
});