import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { Table } from 'https://esm.sh/@glideapps/tables@1.0.5';

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
    
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Parse request body
    const { operation, tableId } = await req.json();
    console.log('Received sync request:', { operation, tableId });
    
    if (!operation || !tableId) {
      throw new Error('Missing required parameters: operation and tableId');
    }

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
      supabase_table_name: glideConfig.supabase_table_name
    });

    const table = new Table(glideConfig.api_token, glideConfig.table_id);

    let result;
    switch (operation) {
      case 'syncBidirectional': {
        console.log('Starting bidirectional sync');
        
        // Get all rows from both systems
        const [glideRows, { data: supabaseRows, error: supabaseError }] = await Promise.all([
          table.rows(),
          supabase.from('telegram_media').select('*')
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
                product_name: supabaseRow.product_name,
                product_code: supabaseRow.product_code,
                quantity: supabaseRow.quantity,
                vendor_uid: supabaseRow.vendor_uid,
                purchase_date: supabaseRow.purchase_date,
                notes: supabaseRow.notes,
                telegram_data: JSON.stringify(supabaseRow.telegram_data),
                created_at: supabaseRow.created_at,
                updated_at: supabaseRow.updated_at
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
                  product_name: supabaseRow.product_name,
                  product_code: supabaseRow.product_code,
                  quantity: supabaseRow.quantity,
                  vendor_uid: supabaseRow.vendor_uid,
                  purchase_date: supabaseRow.purchase_date,
                  notes: supabaseRow.notes,
                  telegram_data: JSON.stringify(supabaseRow.telegram_data),
                  updated_at: supabaseRow.updated_at
                });
                syncResult.updated++;
              }
            }
          } catch (error) {
            console.error('Error syncing to Glide:', error);
            syncResult.errors.push(`Error syncing to Glide: ${error.message}`);
          }
        }

        // Sync Glide -> Supabase (only update existing records)
        for (const [id, glideRow] of glideMap) {
          try {
            const supabaseRow = supabaseMap.get(id);
            if (supabaseRow) {
              const glideUpdatedAt = new Date(glideRow.get('updated_at') as string);
              const supabaseUpdatedAt = new Date(supabaseRow.updated_at);

              if (glideUpdatedAt > supabaseUpdatedAt) {
                const { error: updateError } = await supabase
                  .from('telegram_media')
                  .update({
                    caption: glideRow.get('caption'),
                    product_name: glideRow.get('product_name'),
                    product_code: glideRow.get('product_code'),
                    quantity: glideRow.get('quantity'),
                    vendor_uid: glideRow.get('vendor_uid'),
                    purchase_date: glideRow.get('purchase_date'),
                    notes: glideRow.get('notes'),
                    updated_at: glideRow.get('updated_at')
                  })
                  .eq('id', id);

                if (updateError) {
                  throw updateError;
                }
                syncResult.updated++;
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