import { serve } from "https://deno.land/std@0.131.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { operation, tableId, recordIds } = await req.json();

    console.log('Received sync request:', { operation, tableId, recordIds });

    if (!operation) {
      throw new Error('Operation is required');
    }

    if (operation === 'syncBidirectional') {
      // Get the Glide configuration
      const { data: config, error: configError } = await supabase
        .from('glide_config')
        .select('*')
        .eq('id', tableId)
        .single();

      if (configError) {
        throw configError;
      }

      if (!config.active || !config.supabase_table_name) {
        throw new Error('Glide configuration is not active or table is not linked');
      }

      console.log('Found config:', config);

      // Get records to sync
      let query = supabase
        .from('telegram_media')
        .select('*');

      // If specific records are requested, filter for those
      if (recordIds && recordIds.length > 0) {
        query = query.in('id', recordIds);
      }

      const { data: records, error: recordsError } = await query;

      if (recordsError) {
        throw recordsError;
      }

      console.log(`Found ${records?.length || 0} records to sync`);

      let added = 0;
      let updated = 0;
      let deleted = 0;
      const errors: string[] = [];

      // Process each record
      for (const record of records || []) {
        try {
          // Map the record to Glide format
          const glideData = {
            id: record.id,
            file_id: record.file_id,
            file_unique_id: record.file_unique_id,
            file_type: record.file_type,
            public_url: record.public_url,
            product_name: record.product_name,
            product_code: record.product_code,
            quantity: record.quantity,
            telegram_data: JSON.stringify(record.telegram_data),
            glide_data: JSON.stringify(record.glide_data),
            media_metadata: JSON.stringify(record.media_metadata),
            processed: record.processed,
            processing_error: record.processing_error,
            last_synced_at: record.last_synced_at,
            created_at: record.created_at,
            updated_at: record.updated_at,
            message_id: record.message_id,
            caption: record.caption,
            vendor_uid: record.vendor_uid,
            purchase_date: record.purchase_date,
            notes: record.notes,
            analyzed_content: JSON.stringify(record.analyzed_content),
            purchase_order_uid: record.purchase_order_uid,
            default_public_url: record.default_public_url
          };

          // Update or insert the record
          const { error: upsertError } = await supabase
            .from(config.supabase_table_name)
            .upsert(glideData);

          if (upsertError) {
            throw upsertError;
          }

          // Track statistics
          if (record.last_synced_at) {
            updated++;
          } else {
            added++;
          }

          // Update last_synced_at
          await supabase
            .from('telegram_media')
            .update({ last_synced_at: new Date().toISOString() })
            .eq('id', record.id);

        } catch (error) {
          console.error('Error processing record:', error);
          errors.push(`Error processing record ${record.id}: ${error.message}`);
        }
      }

      const response = {
        success: true,
        data: {
          added,
          updated,
          deleted,
          errors
        },
        stats: {
          processedItems: records?.length || 0,
          skippedItems: 0,
          errorItems: errors.length,
          totalTime: 0,
          details: {}
        }
      };

      console.log('Sync completed:', response);

      return new Response(
        JSON.stringify(response),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    throw new Error(`Unknown operation: ${operation}`);

  } catch (error) {
    console.error('Error in sync function:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});