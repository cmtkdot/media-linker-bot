import { serve } from "https://deno.land/std@0.131.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "./cors.ts";

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

    // Process sync based on operation type
    switch (operation) {
      case 'syncToGlide': {
        // Sync from Supabase to Glide
        const { data: records, error: recordsError } = await supabase
          .from(config.supabase_table_name)
          .select('*')
          .is('last_synced_at', null);

        if (recordsError) throw recordsError;

        const syncResults = {
          added: 0,
          updated: 0,
          errors: [] as string[]
        };

        // Process records
        for (const record of records || []) {
          try {
            // Call Glide API to sync record
            // Implementation depends on your Glide API structure
            syncResults.added++;
          } catch (error) {
            syncResults.errors.push(`Error syncing record ${record.id}: ${error.message}`);
          }
        }

        return new Response(
          JSON.stringify(syncResults),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'syncFromGlide': {
        // Sync from Glide to Supabase
        const { records } = await req.json();
        
        const syncResults = {
          updated: 0,
          errors: [] as string[]
        };

        // Process records from Glide
        for (const record of records || []) {
          try {
            const { error: updateError } = await supabase
              .from(config.supabase_table_name)
              .upsert({
                ...record,
                last_synced_at: new Date().toISOString()
              });

            if (updateError) throw updateError;
            syncResults.updated++;
          } catch (error) {
            syncResults.errors.push(`Error updating record: ${error.message}`);
          }
        }

        return new Response(
          JSON.stringify(syncResults),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
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