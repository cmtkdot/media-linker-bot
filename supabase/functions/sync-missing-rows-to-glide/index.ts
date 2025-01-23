import { serve } from "https://deno.land/std@0.131.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const GLIDE_API_TOKEN = Deno.env.get('GLIDE_API_TOKEN')!;

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get active Glide config
    const { data: configs, error: configError } = await supabaseClient
      .from('glide_config')
      .select('*')
      .eq('active', true)
      .limit(1);

    if (configError) throw configError;
    if (!configs?.length) throw new Error('No active Glide configuration found');

    const config = configs[0];

    // Fetch data from Glide
    const glideResponse = await fetch('https://api.glideapp.io/api/function/queryTables', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GLIDE_API_TOKEN}`
      },
      body: JSON.stringify({
        appID: config.app_id,
        queries: [{
          tableName: config.table_id,
          utc: true
        }]
      })
    });

    if (!glideResponse.ok) {
      throw new Error(`Glide API error: ${await glideResponse.text()}`);
    }

    const glideData = await glideResponse.json();

    // Get differences using the database function
    const { data: differences, error: diffError } = await supabaseClient
      .rpc('check_telegram_media_differences');

    if (diffError) throw diffError;

    // Process differences
    if (differences?.length > 0) {
      const batchId = crypto.randomUUID();
      
      // Queue the differences for sync
      await Promise.all(differences.map(async (diff) => {
        await supabaseClient
          .from('glide_sync_queue')
          .insert({
            table_name: 'telegram_media',
            record_id: diff.record_id,
            operation: diff.difference_type === 'missing_in_glide' ? 'INSERT' : 'UPDATE',
            new_data: diff.supabase_data,
            old_data: diff.glide_data,
            priority: 2, // Higher priority for differences
            batch_id: batchId
          });
      }));
    }

    return new Response(
      JSON.stringify({
        success: true,
        differences_found: differences?.length || 0
      }),
      { 
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    console.error('Error in sync-missing-rows:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 400
      }
    );
  }
});