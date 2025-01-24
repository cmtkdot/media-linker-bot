import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleWebhookUpdate } from "../_shared/webhook-handler.ts";
import { corsHeaders } from "../_shared/cors.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
const TELEGRAM_WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') || '';

serve(async (req) => {
  try {
    // Handle CORS
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse request body
    const update = await req.json();
    console.log('Received webhook update:', {
      update_id: update.update_id,
      has_message: !!update.message,
      has_channel_post: !!update.channel_post,
      media_group_id: update.message?.media_group_id || update.channel_post?.media_group_id
    });

    try {
      const result = await handleWebhookUpdate(update, supabaseClient, TELEGRAM_BOT_TOKEN);
      console.log('Successfully processed webhook:', result);

      return new Response(
        JSON.stringify(result),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    } catch (error) {
      console.error('Error in webhook handler:', {
        error: error.message,
        stack: error.stack,
        update_id: update.update_id,
        media_group_id: update.message?.media_group_id || update.channel_post?.media_group_id
      });

      // Store failed webhook update for retry
      try {
        await supabaseClient
          .from('unified_processing_queue')
          .insert({
            queue_type: 'webhook',
            data: update,
            error_message: error.message,
            chat_id: update.message?.chat?.id || update.channel_post?.chat?.id,
            message_id: update.message?.message_id || update.channel_post?.message_id,
            correlation_id: crypto.randomUUID()
          });
      } catch (dbError) {
        console.error('Failed to store failed webhook update:', dbError);
      }

      return new Response(
        JSON.stringify({ 
          error: 'Error processing webhook update',
          details: error.message
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      );
    }
  } catch (error) {
    console.error('Critical error in webhook endpoint:', {
      error: error.message,
      stack: error.stack
    });

    return new Response(
      JSON.stringify({ 
        error: 'Critical error in webhook endpoint',
        details: error.message
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});