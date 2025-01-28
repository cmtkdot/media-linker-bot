import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { processMediaMessage } from "../_shared/media-processor.ts";
import { handleMediaError } from "../_shared/error-handler.ts";

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

    // Get pending messages from the queue
    const { data: messages, error: fetchError } = await supabase
      .from('messages')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10);

    if (fetchError) throw fetchError;
    
    console.log(`Processing ${messages?.length || 0} pending messages`);

    if (!messages?.length) {
      return new Response(
        JSON.stringify({ message: 'No pending messages to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = [];
    for (const message of messages) {
      try {
        const mediaData = message.message_media_data?.media;
        if (!mediaData) {
          console.log(`No media data found for message ${message.id}`);
          continue;
        }

        const result = await processMediaMessage(
          supabase,
          message.id,
          mediaData.file_id,
          mediaData.file_unique_id,
          mediaData.file_type,
          Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '',
          mediaData,
          message.correlation_id
        );

        results.push({
          messageId: message.id,
          status: 'processed',
          result
        });

      } catch (error) {
        console.error(`Error processing message ${message.id}:`, error);
        
        const { shouldRetry } = await handleMediaError(
          supabase,
          error,
          message.id,
          message.correlation_id,
          'process-message-queue',
          message.retry_count
        );

        results.push({
          messageId: message.id,
          status: shouldRetry ? 'pending' : 'failed',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        message: 'Queue processing completed',
        results 
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        } 
      }
    );

  } catch (error) {
    console.error('Error in queue processor:', error);
    
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 500
      }
    );
  }
});