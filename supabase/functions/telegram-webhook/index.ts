import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from "../_shared/cors.ts";
import { handleWebhookUpdate } from "../_shared/webhook-handler.ts";
import { handleProcessingError } from "../_shared/error-handler.ts";

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
    
    console.log('Processing Telegram update:', {
      update_id: update.update_id,
      message_id: update.message?.message_id,
      chat_id: update.message?.chat?.id,
      message_type: update.message?.photo ? 'photo' : 
                   update.message?.video ? 'video' : 
                   update.message?.document ? 'document' : 
                   update.message?.animation ? 'animation' : 'unknown'
    });

    const result = await handleWebhookUpdate(update, supabase, TELEGRAM_BOT_TOKEN);
    
    console.log('Successfully processed update:', {
      update_id: update.update_id,
      message_id: update.message?.message_id,
      chat_id: update.message?.chat?.id,
      result
    });
    
    return new Response(
      JSON.stringify({ ok: true, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in webhook handler:', {
      error: error.message,
      stack: error.stack
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    await handleProcessingError(
      supabase,
      error,
      { message_id: 0, id: 'webhook_error' },
      0
    );
    
    return new Response(
      JSON.stringify({ 
        ok: false,
        error: 'Internal server error',
        details: error.message
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: error.status || 500
      }
    );
  }
});