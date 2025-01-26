import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting retry process for pending/failed messages');

    // First, handle messages table retries
    const { data: pendingMessages, error: fetchError } = await supabase
      .from('messages')
      .select('*')
      .in('status', ['pending', 'error'])
      .lt('retry_count', 3)
      .order('created_at', { ascending: true })
      .limit(50);

    if (fetchError) throw fetchError;

    console.log(`Found ${pendingMessages?.length || 0} pending/failed messages to retry`);

    const messageResults = {
      processed: 0,
      failed: 0,
      maxRetries: 0
    };

    // Process each pending message
    for (const message of pendingMessages || []) {
      try {
        if (message.retry_count >= 3) {
          // Update to permanent failure if max retries reached
          await supabase
            .from('messages')
            .update({
              status: 'failed',
              processing_error: 'Max retry attempts reached',
              updated_at: new Date().toISOString(),
              last_retry_at: new Date().toISOString()
            })
            .eq('id', message.id);
          
          messageResults.maxRetries++;
          continue;
        }

        // Increment retry count and update timestamp
        const { error: updateError } = await supabase
          .from('messages')
          .update({
            retry_count: (message.retry_count || 0) + 1,
            last_retry_at: new Date().toISOString(),
            status: 'pending',
            updated_at: new Date().toISOString()
          })
          .eq('id', message.id);

        if (updateError) throw updateError;
        messageResults.processed++;
      } catch (error) {
        console.error(`Error processing message ${message.id}:`, error);
        messageResults.failed++;
      }
    }

    // Next, handle unified queue retries
    const { data: queueItems, error: queueFetchError } = await supabase
      .from('unified_processing_queue')
      .select('*')
      .in('status', ['pending', 'error'])
      .lt('retry_count', 3)
      .order('created_at', { ascending: true })
      .limit(50);

    if (queueFetchError) throw queueFetchError;

    console.log(`Found ${queueItems?.length || 0} pending/failed queue items to retry`);

    const queueResults = {
      processed: 0,
      failed: 0,
      maxRetries: 0
    };

    // Process each queue item
    for (const item of queueItems || []) {
      try {
        if (item.retry_count >= 3) {
          // Update to permanent failure if max retries reached
          await supabase
            .from('unified_processing_queue')
            .update({
              status: 'failed',
              error_message: 'Max retry attempts reached',
              processed_at: new Date().toISOString()
            })
            .eq('id', item.id);
          
          queueResults.maxRetries++;
          continue;
        }

        // Increment retry count and reset status to pending
        const { error: updateError } = await supabase
          .from('unified_processing_queue')
          .update({
            retry_count: (item.retry_count || 0) + 1,
            status: 'pending',
            error_message: null
          })
          .eq('id', item.id);

        if (updateError) throw updateError;
        queueResults.processed++;
      } catch (error) {
        console.error(`Error processing queue item ${item.id}:`, error);
        queueResults.failed++;
      }
    }

    return new Response(
      JSON.stringify({
        messages: messageResults,
        queue: queueResults
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in retry-pending-messages:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});