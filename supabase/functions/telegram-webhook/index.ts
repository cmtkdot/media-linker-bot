import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from "../_shared/cors.ts"
import { TelegramUpdate } from "../_shared/telegram-types.ts"
import { analyzeCaption, getMessageType } from "../_shared/telegram-service.ts"
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

    const message = update.message || update.channel_post;
    if (!message) {
      return new Response(
        JSON.stringify({ message: 'No message in update' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    let productInfo = null;
    if (message.caption) {
      productInfo = await analyzeCaption(message.caption, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      console.log('AI-extracted product info:', productInfo);
    }

    const messageRecord = await createMessage(supabase, message, productInfo);
    console.log('Created message record:', messageRecord);

    const mediaTypes = ['photo', 'video', 'document', 'animation'] as const;
    let mediaFile = null;
    let mediaType = '';

    for (const type of mediaTypes) {
      if (message[type]) {
        mediaFile = type === 'photo' 
          ? message[type]![message[type]!.length - 1]
          : message[type];
        mediaType = type;
        break;
      }
    }

    if (!mediaFile) {
      return new Response(
        JSON.stringify({ message: 'Message processed (no media)' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    await processMediaFile(
      supabase,
      mediaFile,
      mediaType,
      message,
      messageRecord,
      TELEGRAM_BOT_TOKEN,
      productInfo
    );

    return new Response(
      JSON.stringify({ message: 'Successfully processed message and media' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});