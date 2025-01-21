import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

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

    console.log('Fetching records without Glide row ID...');
    
    const { data: missingGlideRecords, error } = await supabase
      .from('telegram_media')
      .select('*')
      .is('telegram_media_row_id', null);

    if (error) {
      console.error('Error fetching records:', error);
      throw error;
    }

    if (!missingGlideRecords || missingGlideRecords.length === 0) {
      console.log('No missing Glide records found.');
      return new Response(
        JSON.stringify({ message: 'No missing Glide records found.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${missingGlideRecords.length} records missing Glide row IDs`);

    const queueEntries = missingGlideRecords.map((record) => ({
      table_name: 'telegram_media',
      record_id: record.id,
      operation: 'INSERT',
      old_data: null,
      new_data: record,
      created_at: new Date().toISOString()
    }));

    const { error: queueError } = await supabase
      .from('glide_sync_queue')
      .insert(queueEntries);

    if (queueError) {
      console.error('Error inserting queue entries:', queueError);
      throw queueError;
    }

    console.log(`Successfully queued ${queueEntries.length} records for sync`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Queued ${queueEntries.length} record(s) for addition to Glide.`
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