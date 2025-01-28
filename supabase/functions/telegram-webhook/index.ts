import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { WebhookUpdate, WebhookResponse } from "../_shared/webhook-types.ts";
import { analyzeCaptionWithAI } from "../_shared/caption-analyzer.ts";

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

    // Initialize Supabase client
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

    // Generate message URL
    const chatId = message.chat.id.toString();
    const messageUrl = `https://t.me/c/${chatId.substring(4)}/${message.message_id}`;

    // Analyze message content
    let analyzedContent = null;
    let isOriginalCaption = false;
    let originalMessageId = null;

    if (message.caption) {
      console.log('Analyzing caption:', message.caption);
      analyzedContent = await analyzeCaptionWithAI(message.caption);
      isOriginalCaption = true;
    } else if (message.media_group_id) {
      // Check for existing analyzed content in the group
      const { data: existingMessages } = await supabaseClient
        .from('messages')
        .select('*')
        .eq('media_group_id', message.media_group_id)
        .order('created_at', { ascending: true });

      if (existingMessages?.length) {
        const existingCaption = existingMessages.find(m => m.is_original_caption);
        if (existingCaption) {
          analyzedContent = existingCaption.analyzed_content;
          originalMessageId = existingCaption.id;
          isOriginalCaption = false;
        }
      }
    }

    // Build message_media_data structure
    const messageMediaData = {
      message: {
        url: messageUrl,
        media_group_id: message.media_group_id,
        caption: message.caption,
        message_id: message.message_id,
        chat_id: message.chat.id,
        date: message.date
      },
      sender: {
        sender_info: message.from || message.sender_chat || {},
        chat_info: message.chat
      },
      analysis: {
        analyzed_content: analyzedContent,
        product_name: analyzedContent?.analyzed_content?.extracted_data?.product_name,
        product_code: analyzedContent?.analyzed_content?.extracted_data?.product_code,
        quantity: analyzedContent?.analyzed_content?.extracted_data?.quantity,
        vendor_uid: analyzedContent?.analyzed_content?.extracted_data?.vendor_uid,
        purchase_date: analyzedContent?.analyzed_content?.extracted_data?.purchase_date,
        notes: analyzedContent?.analyzed_content?.extracted_data?.notes
      },
      meta: {
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'pending',
        error: null,
        is_original_caption: isOriginalCaption,
        original_message_id: originalMessageId,
        processed_at: null,
        last_retry_at: null,
        retry_count: 0
      },
      telegram_data: message
    };

    console.log('Creating message record with data:', {
      message_id: message.message_id,
      chat_id: message.chat.id,
      media_group_id: message.media_group_id,
      correlation_id: correlationId,
      has_analyzed_content: !!analyzedContent
    });

    // Create message record
    const { data: messageRecord, error: messageError } = await supabaseClient
      .from('messages')
      .insert({
        message_id: message.message_id,
        chat_id: message.chat.id,
        sender_info: message.from || message.sender_chat || {},
        message_type: determineMessageType(message),
        telegram_data: message,
        message_url: messageUrl,
        correlation_id: correlationId,
        caption: message.caption,
        text: message.text,
        media_group_id: message.media_group_id,
        media_group_size: message.media_group_id ? 1 : null,
        status: 'pending',
        is_original_caption: isOriginalCaption,
        original_message_id: originalMessageId,
        analyzed_content: analyzedContent,
        message_media_data: messageMediaData
      })
      .select()
      .single();

    if (messageError) {
      console.error('Error creating message record:', messageError);
      throw messageError;
    }

    // Queue for processing if it's a media message
    const messageType = determineMessageType(message);
    if (messageType === 'photo' || messageType === 'video') {
      console.log('Queueing message for processing:', {
        message_id: message.message_id,
        media_group_id: message.media_group_id,
        message_type: messageType
      });

      const { error: queueError } = await supabaseClient
        .from('unified_processing_queue')
        .insert({
          queue_type: message.media_group_id ? 'media_group' : 'media',
          message_media_data: messageMediaData,
          correlation_id: correlationId,
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
        message_media_data: messageMediaData,
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