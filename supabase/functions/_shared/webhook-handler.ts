import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { withDatabaseRetry } from "../_shared/database-retry.ts";
import { analyzeWebhookMessage } from "../_shared/webhook-message-analyzer.ts";
import { buildWebhookMessageData } from "../_shared/webhook-message-builder.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
const TELEGRAM_WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') || '';

serve(async (req) => {
  try {
    // Handle CORS
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

    // Initialize Supabase client with retry wrapper
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

    // Process webhook update with retry logic
    const result = await withDatabaseRetry(
      async () => handleWebhookUpdate(update, supabaseClient, correlationId),
      0,
      'webhook_handler'
    );

    console.log('Webhook processing completed:', {
      success: result.success,
      message_id: result.messageId,
      correlation_id: correlationId
    });

    return new Response(
      JSON.stringify(result),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Error in webhook handler:', {
      error: error.message,
      stack: error.stack
    });

    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        }, 
        status: 500 
      }
    );
  }
});

async function handleWebhookUpdate(update: any, supabase: any, correlationId: string) {
  const message = update.message || update.channel_post;
  if (!message) {
    console.log('No message in update');
    return { message: 'No message in update' };
  }

  try {
    console.log('Processing webhook update:', {
      update_id: update.update_id,
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

    let mediaGroupSize = 0;
    let originalCaptionData = null;
    
    if (message.media_group_id) {
      // Get original caption data if it exists
      const { data: groupMessages } = await supabase
        .from('messages')
        .select('id, is_original_caption, analyzed_content, message_type, media_group_size')
        .eq('media_group_id', message.media_group_id)
        .order('created_at', { ascending: true });
      
      mediaGroupSize = groupMessages?.[0]?.media_group_size || 1;
      
      // Calculate media group size if not already set
      if (!mediaGroupSize) {
        mediaGroupSize = message.photo ? 1 : 0;
        mediaGroupSize += message.video ? 1 : 0;
        mediaGroupSize += message.document ? 1 : 0;
        mediaGroupSize += message.animation ? 1 : 0;
        mediaGroupSize = Math.max(mediaGroupSize, 1);
      }
    }

    const chatId = message.chat.id.toString();
    const messageUrl = `https://t.me/c/${chatId.substring(4)}/${message.message_id}`;
    
    const messageType = message.photo ? 'photo' : 
                       message.video ? 'video' : 
                       message.document ? 'document' : 
                       message.animation ? 'animation' : 'text';

    const analyzedContent = await analyzeWebhookMessage(message, originalCaptionData);
    const messageData = buildWebhookMessageData(message, messageUrl, analyzedContent);

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
        caption: message.caption || originalCaptionData?.caption,
        text: message.text,
        media_group_id: message.media_group_id,
        media_group_size: mediaGroupSize,
        status: 'pending',
        is_original_caption: analyzedContent.is_original_caption,
        original_message_id: originalCaptionData?.id,
        analyzed_content: analyzedContent.analyzed_content || originalCaptionData?.analyzed_content,
        message_media_data: messageData
      })
      .select()
      .single();

    if (messageError) {
      console.error('Error creating message record:', messageError);
      throw messageError;
    }

    return {
      success: true,
      message: 'Update processed successfully',
      messageId: messageRecord.id,
      correlationId: correlationId
    };

  } catch (error) {
    console.error('Error in webhook handler:', error);
    throw error;
  }
}