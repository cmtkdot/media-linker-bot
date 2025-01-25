import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withDatabaseRetry } from "../_shared/database-retry.ts";
import { handleProcessingError } from "../_shared/error-handler.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get pending messages that haven't exceeded max retries
    const { data: pendingMessages, error: fetchError } = await supabase
      .from('messages')
      .select('*')
      .eq('status', 'pending')
      .lt('retry_count', 3) // Max retries set to 3
      .order('created_at', { ascending: true });

    if (fetchError) throw fetchError;

    console.log(`Found ${pendingMessages?.length || 0} pending messages to retry`);

    const results = {
      processed: 0,
      errors: 0,
      details: []
    };

    // Process each pending message
    for (const message of pendingMessages || []) {
      try {
        console.log(`Processing message ${message.id}, retry count: ${message.retry_count}`);

        // Generate a new correlation ID for this retry attempt
        const correlationId = crypto.randomUUID();

        // Update retry metadata
        const { error: updateError } = await supabase
          .from('messages')
          .update({
            retry_count: (message.retry_count || 0) + 1,
            last_retry_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            correlation_id: correlationId // Set the new correlation ID
          })
          .eq('id', message.id);

        if (updateError) throw updateError;

        // Queue for processing in unified_processing_queue
        const { error: queueError } = await supabase
          .from('unified_processing_queue')
          .insert({
            queue_type: message.media_group_id ? 'media_group' : 'media',
            data: {
              message: {
                url: message.message_url,
                media_group_id: message.media_group_id,
                caption: message.caption,
                message_id: message.message_id,
                chat_id: message.chat_id,
                date: message.telegram_data?.date
              },
              sender: {
                sender_info: message.sender_info,
                chat_info: message.telegram_data?.chat
              },
              analysis: {
                analyzed_content: message.analyzed_content,
                processed_at: message.processed_at
              },
              meta: {
                retry_count: (message.retry_count || 0) + 1,
                last_retry_at: new Date().toISOString()
              },
              telegram_data: message.telegram_data
            },
            status: 'pending',
            priority: message.media_group_id ? 2 : 1,
            chat_id: message.chat_id,
            message_id: message.message_id,
            correlation_id: correlationId // Use the same correlation ID
          });

        if (queueError) throw queueError;

        results.processed++;
        console.log(`Successfully queued message ${message.id} for retry`);

      } catch (error) {
        console.error(`Error processing message ${message.id}:`, error);
        results.errors++;
        results.details.push({
          message_id: message.id,
          error: error.message
        });

        // Update message with error status if max retries reached
        if ((message.retry_count || 0) >= 2) { // 3rd retry failed
          await handleProcessingError(
            supabase,
            error,
            message,
            (message.retry_count || 0) + 1,
            true
          );
        }
      }
    }

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in retry-pending-messages:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});