import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { analyzeCaptionWithAI } from "../_shared/caption-analyzer.ts";
import { handleMediaGroup } from "../_shared/media-group-handler.ts";
import { processMediaFiles } from "../_shared/media-processor.ts";
import { handleProcessingError } from "../_shared/error-handler.ts";
import { withDatabaseRetry } from "../_shared/database-retry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Early caption analysis
    let analyzedContent = null;
    if (message.caption) {
      try {
        analyzedContent = await analyzeCaptionWithAI(message.caption, supabase);
      } catch (error) {
        console.error('Error analyzing caption:', error);
      }
    }

    // Generate message URL
    const chatId = message.chat.id.toString();
    const messageUrl = `https://t.me/c/${chatId.substring(4)}/${message.message_id}`;

    // Create message record with retry
    const messageRecord = await withDatabaseRetry(async () => {
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
        product_name: analyzedContent?.product_name,
        product_code: analyzedContent?.product_code,
        quantity: analyzedContent?.quantity,
        vendor_uid: analyzedContent?.vendor_uid,
        purchase_date: analyzedContent?.purchase_date,
        notes: analyzedContent?.notes,
        status: 'pending'
      };

      const { data, error } = await supabase
        .from('messages')
        .upsert(messageData)
        .select()
        .single();

      if (error) throw error;
      return data;
    }, 0, `create_message_${message.message_id}`);

    // Handle media group if present
    if (message.media_group_id) {
      await handleMediaGroup(supabase, message, messageRecord);
    }

    // Process media files if present
    const hasMedia = message.photo || message.video || message.document || message.animation;
    if (hasMedia && messageRecord) {
      await processMediaFiles(message, messageRecord, supabase, TELEGRAM_BOT_TOKEN);
    }

    return new Response(
      JSON.stringify({ 
        ok: true, 
        message: 'Update processed successfully',
        messageId: messageRecord?.id 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in webhook handler:', error);
    return new Response(
      JSON.stringify({ 
        ok: false,
        error: 'Internal server error',
        details: error.message
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
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
