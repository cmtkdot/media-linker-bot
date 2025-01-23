import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from "../_shared/cors.ts";
import { handleWebhookUpdate } from "../_shared/webhook-handler.ts";
import { withDatabaseRetry } from "../_shared/database-retry.ts";
import { analyzeCaptionWithAI } from "../_shared/caption-analyzer.ts";
import { processMediaFiles } from "../_shared/media-processor.ts";

serve(async (req) => {
  console.log('Received webhook request:', req.method);

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

    // Validate webhook secret
    const webhookSecret = req.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (webhookSecret !== TELEGRAM_WEBHOOK_SECRET) {
      return new Response(
        JSON.stringify({ error: 'Invalid webhook secret' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const update = await req.json();
    const message = update.message || update.channel_post;

    if (!message) {
      return new Response(
        JSON.stringify({ ok: true, message: 'No message to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing Telegram update:', {
      update_id: update.update_id,
      message_id: message.message_id,
      chat_id: message.chat.id,
      has_caption: !!message.caption,
      media_group_id: message.media_group_id
    });

    // Generate message URL
    const chatId = message.chat.id.toString();
    const messageUrl = `https://t.me/c/${chatId.substring(4)}/${message.message_id}`;

    // Analyze caption if present
    let analyzedContent = null;
    if (message.caption) {
      try {
        console.log('Analyzing caption:', message.caption);
        analyzedContent = await analyzeCaptionWithAI(message.caption, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        console.log('Caption analysis result:', analyzedContent);
      } catch (error) {
        console.error('Error analyzing caption:', error);
      }
    }

    // Create or update message record with retry
    const messageData = {
      message_id: message.message_id,
      chat_id: message.chat.id,
      sender_info: message.from || message.sender_chat || {},
      message_type: determineMessageType(message),
      message_data: message,
      caption: message.caption,
      media_group_id: message.media_group_id,
      message_url: messageUrl,
      analyzed_content: analyzedContent,
      product_name: analyzedContent?.product_name || null,
      product_code: analyzedContent?.product_code || null,
      quantity: analyzedContent?.quantity || null,
      vendor_uid: analyzedContent?.vendor_uid || null,
      purchase_date: analyzedContent?.purchase_date || null,
      notes: analyzedContent?.notes || null,
      status: 'pending',
      retry_count: 0
    };

    const { data: messageRecord, error: messageError } = await withDatabaseRetry(async () => {
      const { data: existingMessage } = await supabase
        .from('messages')
        .select('*')
        .eq('message_id', message.message_id)
        .eq('chat_id', message.chat.id)
        .maybeSingle();

      if (existingMessage) {
        return await supabase
          .from('messages')
          .update(messageData)
          .eq('id', existingMessage.id)
          .select()
          .single();
      } else {
        return await supabase
          .from('messages')
          .insert([messageData])
          .select()
          .single();
      }
    });

    if (messageError) {
      throw messageError;
    }

    // Process media files if present
    if (hasMedia(message) && messageRecord) {
      await processMediaFiles(message, messageRecord, supabase, TELEGRAM_BOT_TOKEN);
    }

    console.log('Successfully processed update:', {
      update_id: update.update_id,
      message_id: message.message_id,
      chat_id: message.chat.id,
      record_id: messageRecord?.id
    });

    return new Response(
      JSON.stringify({ 
        ok: true, 
        message: 'Update processed successfully',
        messageId: messageRecord?.id 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in webhook handler:', {
      error: error.message,
      stack: error.stack
    });
    
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

function determineMessageType(message: any): string {
  if (message.photo && message.photo.length > 0) return 'photo';
  if (message.video) return 'video';
  if (message.document) return 'document';
  if (message.animation) return 'animation';
  return 'unknown';
}

function hasMedia(message: any): boolean {
  return !!(message.photo || message.video || message.document || message.animation);
}