import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from "../_shared/cors.ts";
import { handleWebhookUpdate } from "../_shared/webhook-handler.ts";
import { MAX_RETRY_ATTEMPTS } from "../_shared/constants.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
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
      return new Response(
        JSON.stringify({ error: 'Invalid webhook secret' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const update = await req.json();
    console.log('Received Telegram update:', JSON.stringify(update));

    try {
      const result = await handleWebhookUpdate(update, supabase, TELEGRAM_BOT_TOKEN);
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    } catch (processingError) {
      console.error('Error processing update:', processingError);
      
      // Get current retry count
      const { data: existingUpdate } = await supabase
        .from('pending_webhook_updates')
        .select('retry_count, id')
        .eq('update_data->message->message_id', update.message?.message_id)
        .eq('update_data->message->chat->id', update.message?.chat.id)
        .maybeSingle();

      const currentRetryCount = existingUpdate?.retry_count || 0;
      const newStatus = currentRetryCount >= MAX_RETRY_ATTEMPTS - 1 ? 'failed' : 'pending';
      
      const updateData = {
        update_data: update,
        status: newStatus,
        retry_count: currentRetryCount + 1,
        error_message: processingError.message,
        last_retry_at: new Date().toISOString()
      };

      if (existingUpdate) {
        await supabase
          .from('pending_webhook_updates')
          .update(updateData)
          .eq('id', existingUpdate.id);
      } else {
        await supabase
          .from('pending_webhook_updates')
          .insert(updateData);
      }

      throw processingError;
    }

  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});