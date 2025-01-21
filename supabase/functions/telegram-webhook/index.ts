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
      console.error('Missing required environment variables:', {
        hasTelegramToken: !!TELEGRAM_BOT_TOKEN,
        hasWebhookSecret: !!TELEGRAM_WEBHOOK_SECRET,
        hasSupabaseUrl: !!SUPABASE_URL,
        hasServiceKey: !!SUPABASE_SERVICE_ROLE_KEY
      });
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
    
    // Log the incoming update with safe stringification of circular references
    console.log('Received Telegram update:', JSON.stringify({
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
      console.log('Successfully processed update:', {
        message_id: update.message?.message_id,
        chat_id: update.message?.chat?.id,
        result
      });
      
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    } catch (processingError) {
      console.error('Error processing update:', {
        error: processingError.message,
        stack: processingError.stack,
        message_id: update.message?.message_id || 'undefined',
        chat_id: update.message?.chat?.id || 'undefined',
        retry_count: processingError.retryCount || 0
      });
      
      // Return a 500 response with detailed error information
      return new Response(
        JSON.stringify({ 
          error: processingError.message,
          details: processingError.stack,
          message_id: update.message?.message_id,
          chat_id: update.message?.chat?.id,
          retry_count: processingError.retryCount || 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
  } catch (error) {
    console.error('Fatal error processing webhook:', {
      error: error.message,
      stack: error.stack
    });
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});