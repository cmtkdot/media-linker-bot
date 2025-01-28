import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { WebhookUpdate, WebhookResponse } from "../_shared/webhook-types.ts";
import { QueueItem } from "../_shared/queue/types.ts";
import { buildWebhookMessageData } from "../_shared/webhook-message-builder.ts";
import { analyzeWebhookMessage } from "../_shared/webhook-message-analyzer.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
const TELEGRAM_WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') || '';

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

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

    const update = await req.json() as WebhookUpdate;
    const correlationId = crypto.randomUUID();
    const message = update.message || update.channel_post;

    if (!message) {
      console.log('No message in update');
      return new Response(
        JSON.stringify({ message: 'No message in update' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing webhook update:', {
      update_id: update.update_id,
      message_id: message.message_id,
      chat_id: message.chat.id,
      media_group_id: message.media_group_id,
      has_caption: !!message.caption
    });

    const chatId = message.chat.id.toString();
    const messageUrl = `https://t.me/c/${chatId.substring(4)}/${message.message_id}`;

    // Analyze message content
    const analyzedContent = await analyzeWebhookMessage(message);
    
    // Build message data structure using shared utility
    const messageData = buildWebhookMessageData(message, messageUrl, analyzedContent);

    console.log('Creating message record with data:', {
      message_id: message.message_id,
      chat_id: message.chat.id,
      message_type: determineMessageType(message),
      media_group_id: message.media_group_id,
      correlation_id: correlationId,
      has_analyzed_content: !!analyzedContent?.analyzed_content
    });

    // Create message record with telegram_data
    const { data: messageRecord, error: messageError } = await supabaseClient
      .from('messages')
      .insert({
        message_id: message.message_id,
        chat_id: message.chat.id,
        sender_info: message.from || message.sender_chat || {},
        message_type: determineMessageType(message),
        telegram_data: message, // Ensure telegram_data is included
        message_url: messageUrl,
        correlation_id: correlationId,
        caption: message.caption,
        text: message.text,
        media_group_id: message.media_group_id,
        media_group_size: message.media_group_id ? 1 : null,
        status: 'pending',
        is_original_caption: analyzedContent.is_original_caption,
        original_message_id: analyzedContent.original_message_id,
        analyzed_content: analyzedContent.analyzed_content,
        message_media_data: {
          ...messageData,
          telegram_data: message // Include telegram_data in message_media_data
        },
        last_group_message_at: new Date().toISOString()
      })
      .select()
      .single();

    if (messageError) {
      console.error('Error creating message record:', messageError);
      throw messageError;
    }

    console.log('Message record created:', {
      record_id: messageRecord.id,
      message_id: messageRecord.message_id,
      chat_id: messageRecord.chat_id,
      message_type: messageRecord.message_type,
      has_telegram_data: !!messageRecord.telegram_data
    });

    // Queue for processing if it's a media message
    const messageType = determineMessageType(message);
    if (messageType === 'photo' || messageType === 'video') {
      console.log('Queueing message for processing:', {
        message_id: message.message_id,
        media_group_id: message.media_group_id,
        message_type: messageType
      });

      const queueItem: QueueItem = {
        id: messageRecord.id,
        queue_type: message.media_group_id ? 'media_group' : 'media',
        message_media_data: {
          ...messageData,
          telegram_data: message // Ensure telegram_data is included in queue item
        },
        correlation_id: correlationId,
        status: 'pending'
      };

      const { error: queueError } = await supabaseClient
        .from('unified_processing_queue')
        .insert({
          ...queueItem,
          chat_id: message.chat.id,
          message_id: message.message_id,
          priority: message.media_group_id ? 2 : 1
        });

      if (queueError) {
        console.error('Error queueing message:', queueError);
        throw queueError;
      }
    }

    const response: WebhookResponse = {
      success: true,
      message: 'Update processed successfully',
      messageId: messageRecord.id,
      data: {
        telegram_data: messageRecord.telegram_data,
        message_media_data: messageRecord.message_media_data,
        status: messageRecord.status
      }
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in webhook handler:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack
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
  return 'text';
}