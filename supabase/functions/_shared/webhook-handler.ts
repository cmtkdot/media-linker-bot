import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "./cors.ts";
import { analyzeWebhookMessage } from "./webhook-message-analyzer.ts";
import { buildWebhookMessageData } from "./webhook-message-builder.ts";
import { processMediaFile } from "./media-processor.ts";
import { withDatabaseRetry } from "./database-retry.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
const TELEGRAM_WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') || '';

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    // Validate webhook secret
    const secretHeader = req.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (!secretHeader || secretHeader !== TELEGRAM_WEBHOOK_SECRET) {
      console.error('Invalid webhook secret');
      return new Response(
        JSON.stringify({ error: 'Invalid webhook secret' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const update = await req.json();
    const correlationId = crypto.randomUUID();

    console.log('Received webhook update:', {
      update_id: update.update_id,
      has_message: !!update.message,
      has_channel_post: !!update.channel_post,
      correlation_id: correlationId
    });

    const result = await withDatabaseRetry(
      async () => handleWebhookUpdate(update, supabaseClient, correlationId, TELEGRAM_BOT_TOKEN),
      0,
      'webhook_handler'
    );

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in webhook handler:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

async function handleWebhookUpdate(update: any, supabase: any, correlationId: string, botToken: string) {
  const message = update.message || update.channel_post;
  if (!message) {
    return { message: 'No message in update' };
  }

  try {
    console.log('Processing webhook update:', {
      message_id: message.message_id,
      chat_id: message.chat.id,
      media_group_id: message.media_group_id,
      has_caption: !!message.caption
    });

    // Check for existing message
    const { data: existingMessage } = await supabase
      .from('messages')
      .select('id, is_original_caption, analyzed_content')
      .eq('message_id', message.message_id)
      .eq('chat_id', message.chat.id)
      .maybeSingle();

    if (existingMessage) {
      console.log('Message already exists:', {
        message_id: message.message_id,
        existing_id: existingMessage.id
      });
      return {
        success: true,
        message: 'Message already exists',
        messageId: existingMessage.id
      };
    }

    const chatId = message.chat.id.toString();
    const messageUrl = `https://t.me/c/${chatId.substring(4)}/${message.message_id}`;
    
    const messageType = message.photo ? 'photo' : 
                       message.video ? 'video' : 
                       message.document ? 'document' : 
                       message.animation ? 'animation' : 'text';

    const analyzedContent = await analyzeWebhookMessage(message);
    const messageData = buildWebhookMessageData(message, messageUrl, analyzedContent);

    // Create message record
    const { data: messageRecord, error: messageError } = await supabase
      .from('messages')
      .insert({
        message_id: message.message_id,
        chat_id: message.chat.id,
        sender_info: message.from || message.sender_chat || {},
        message_type: messageType,
        telegram_data: message,
        message_url: messageUrl,
        correlation_id: correlationId,
        caption: message.caption,
        text: message.text,
        media_group_id: message.media_group_id,
        status: 'pending',
        is_original_caption: analyzedContent.is_original_caption,
        original_message_id: analyzedContent.original_message_id,
        analyzed_content: analyzedContent.analyzed_content,
        message_media_data: messageData
      })
      .select()
      .single();

    if (messageError) {
      console.error('Error creating message record:', messageError);
      throw messageError;
    }

    // Process media if present
    if (messageType !== 'text') {
      const mediaFile = message.photo?.[0] || message.video || message.document || message.animation;
      if (mediaFile) {
        await processMediaFile(supabase, {
          fileId: mediaFile.file_id,
          fileUniqueId: mediaFile.file_unique_id,
          fileType: messageType,
          messageId: messageRecord.id,
          botToken,
          correlationId
        });
      }
    }

    return {
      success: true,
      message: 'Update processed successfully',
      messageId: messageRecord.id,
      correlationId
    };

  } catch (error) {
    console.error('Error processing webhook update:', error);
    throw error;
  }
}