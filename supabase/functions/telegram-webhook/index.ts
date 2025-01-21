import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from "../_shared/cors.ts"
import { TelegramUpdate } from "../_shared/telegram-types.ts"
import { analyzeCaption } from "../_shared/telegram-service.ts"
import { createMessage, processMediaFile } from "../_shared/database-service.ts"

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
    const update: TelegramUpdate = await req.json();
    console.log('Received Telegram update:', JSON.stringify(update));

    try {
      const message = update.message || update.channel_post;
      if (!message) {
        return new Response(
          JSON.stringify({ message: 'No message in update' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      // Check if this is a media message
      const hasMedia = message.photo || message.video || message.document || message.animation;
      if (!hasMedia) {
        return new Response(
          JSON.stringify({ message: 'Not a media message, skipping' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      // Check for existing message to prevent duplicates
      const { data: existingMessage } = await supabase
        .from('messages')
        .select('id')
        .eq('chat_id', message.chat.id)
        .eq('message_id', message.message_id)
        .single();

      if (existingMessage) {
        return new Response(
          JSON.stringify({ message: 'Message already processed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      // Store the update for processing
      const { error: storageError } = await supabase
        .from('pending_webhook_updates')
        .insert({
          update_data: update,
          status: 'pending'
        });

      if (storageError) {
        throw storageError;
      }

      return new Response(
        JSON.stringify({ message: 'Update queued for processing' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );

    } catch (processingError) {
      console.error('Error processing update:', processingError);
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