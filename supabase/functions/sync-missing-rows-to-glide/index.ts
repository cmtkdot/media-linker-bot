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

    let addedCount = 0;
    let skippedCount = 0;
    const errors = [];

    // Process each record individually to better handle duplicates
    for (const record of missingGlideRecords) {
      try {
        const { error: queueError } = await supabase
          .from('glide_sync_queue')
          .insert({
            table_name: 'telegram_media',
            record_id: record.id,
            operation: 'INSERT',
            old_data: null,
            new_data: record,
            created_at: new Date().toISOString()
          });

        if (queueError) {
          if (queueError.message?.includes('duplicate key value')) {
            console.log(`Skipping duplicate record: ${record.id}`);
            skippedCount++;
          } else {
            console.error(`Error queueing record ${record.id}:`, queueError);
            errors.push({
              record_id: record.id,
              error: queueError.message
            });
          }
        } else {
          addedCount++;
        }
      } catch (error) {
        console.error(`Error processing record ${record.id}:`, error);
        errors.push({
          record_id: record.id,
          error: error.message
        });
      }
    }

    console.log(`Successfully processed records:`, {
      added: addedCount,
      skipped: skippedCount,
      errors: errors.length
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${missingGlideRecords.length} records. Added: ${addedCount}, Skipped: ${skippedCount}, Errors: ${errors.length}`,
        details: {
          added: addedCount,
          skipped: skippedCount,
          errors: errors
        }
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
        details: {
          type: error.code || 'UNKNOWN_ERROR',
          message: error.message,
          stack: error.stack
        }
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