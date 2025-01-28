import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN is not set');
    }

    const correlationId = crypto.randomUUID();
    console.log('Starting queue processing:', { correlationId });

    // Get pending messages with message_media_data
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*, message_media_data')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10);

    if (messagesError) throw messagesError;

    console.log(`Found ${messages?.length || 0} pending messages to process`);

    const results = {
      processed: 0,
      skipped: 0,
      errors: 0,
      details: [] as any[]
    };

    // Process each message
    for (const message of messages || []) {
      try {
        // Skip messages without media data
        if (!message.message_media_data?.media?.file_id) {
          console.log('Skipping message without media:', message.id);
          results.skipped++;
          results.details.push({
            id: message.id,
            status: 'skipped',
            reason: 'No media data'
          });
          continue;
        }

        // Process the media file
        const response = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/process-media-file`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              messageId: message.id,
              botToken,
              correlationId
            })
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to process media: ${response.statusText}`);
        }

        results.processed++;
        results.details.push({
          id: message.id,
          status: 'success'
        });

      } catch (error) {
        console.error('Error processing message:', error);
        results.errors++;
        results.details.push({
          id: message.id,
          status: 'error',
          error: error.message
        });

        // Update message with error
        await supabase
          .from('messages')
          .update({
            processing_error: error.message,
            retry_count: (message.retry_count || 0) + 1,
            last_retry_at: new Date().toISOString(),
            message_media_data: {
              ...message.message_media_data,
              meta: {
                ...message.message_media_data?.meta,
                error: error.message,
                retry_count: (message.retry_count || 0) + 1,
                last_retry_at: new Date().toISOString()
              }
            }
          })
          .eq('id', message.id);
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Queue processing completed',
        results,
        correlationId
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
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
        details: error
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