import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from "../_shared/cors.ts";
import { handleWebhookUpdate } from "../_shared/webhook-handler.ts";
import { MAX_RETRY_ATTEMPTS } from "../_shared/constants.ts";

serve(async (req) => {
  console.log('Received webhook request:', req.method);

  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const TELEGRAM_WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_WEBHOOK_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing required environment variables');
      throw new Error('Missing required environment variables');
    }

    const webhookSecret = req.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (webhookSecret !== TELEGRAM_WEBHOOK_SECRET) {
      console.error('Invalid webhook secret received');
      return new Response(
        JSON.stringify({ error: 'Invalid webhook secret' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const update = await req.json();
    
    console.log('Processing Telegram update:', JSON.stringify({
      update_id: update.update_id,
      message_id: update.message?.message_id,
      chat_id: update.message?.chat?.id,
      message_type: update.message?.photo ? 'photo' : 
                   update.message?.video ? 'video' : 
                   update.message?.document ? 'document' : 
                   update.message?.animation ? 'animation' : 'unknown'
    }));

    try {
      const result = await handleWebhookUpdate(update, supabase, TELEGRAM_BOT_TOKEN);
      
      // Log successful processing
      console.log('Successfully processed update:', {
        update_id: update.update_id,
        message_id: update.message?.message_id,
        chat_id: update.message?.chat?.id,
        result
      });
      
      return new Response(
        JSON.stringify({ ok: true, result }),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          }, 
          status: 200 
        }
      );
    } catch (processingError) {
      // Log the error with detailed information
      console.error('Error processing update:', {
        error: processingError.message,
        stack: processingError.stack,
        update_id: update.update_id,
        message_id: update.message?.message_id || 'undefined',
        chat_id: update.message?.chat?.id || 'undefined',
        retry_count: processingError.retryCount || 0
      });

      // Log to failed_webhook_updates table
      await supabase.from('failed_webhook_updates').insert({
        message_id: update.message?.message_id,
        chat_id: update.message?.chat?.id,
        error_message: processingError.message,
        error_stack: processingError.stack,
        message_data: update,
        status: 'failed'
      });

      // Return a 200 status to acknowledge receipt even if processing failed
      // This prevents Telegram from retrying the same update
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: processingError.message,
          details: {
            update_id: update.update_id,
            message_id: update.message?.message_id,
            chat_id: update.message?.chat?.id,
            retry_count: processingError.retryCount || 0
          }
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 200 // Return 200 even for errors to acknowledge receipt
        }
      );
    }
  } catch (error) {
    console.error('Fatal error in webhook handler:', {
      error: error.message,
      stack: error.stack
    });
    
    // Return 200 to acknowledge receipt, even for fatal errors
    return new Response(
      JSON.stringify({ 
        ok: false,
        error: 'Internal server error',
        details: error.message
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 200 // Return 200 even for fatal errors to acknowledge receipt
      }
    );
  }
});