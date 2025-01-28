import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { analyzeCaptionWithAI } from "../_shared/caption-analyzer.ts";
import { processMessageContent } from "../_shared/message-group-sync.ts";

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

    const update = await req.json();
    const correlationId = crypto.randomUUID();
    const message = update.message || update.channel_post;
    
    if (!message) {
      console.log('No message in update');
      return new Response(
        JSON.stringify({ message: 'No message in update' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate message URL
    const chatId = message.chat.id.toString();
    const messageUrl = `https://t.me/c/${chatId.substring(4)}/${message.message_id}`;

    // Analyze caption if present
    let analyzedContent = null;
    if (message.caption) {
      try {
        analyzedContent = await analyzeCaptionWithAI(message.caption);
        console.log('Caption analyzed:', { 
          message_id: message.message_id,
          correlation_id: correlationId,
          analyzed_content: analyzedContent
        });
      } catch (error) {
        console.error('Error analyzing caption:', error);
      }
    }

    // Process message content and handle media group syncing
    const { isOriginalCaption, originalMessageId, analyzedContent: syncedContent } = 
      await processMessageContent(
        supabaseClient,
        message,
        message.media_group_id,
        analyzedContent,
        false,
        correlationId
      );

    // Use synced content if available
    if (syncedContent) {
      analyzedContent = syncedContent;
    }

    // Create message media data structure
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
        chat_info: message.chat || {}
      },
      analysis: {
        analyzed_content: analyzedContent,
        product_name: analyzedContent?.extracted_data?.product_name,
        product_code: analyzedContent?.extracted_data?.product_code,
        quantity: analyzedContent?.extracted_data?.quantity,
        vendor_uid: analyzedContent?.extracted_data?.vendor_uid,
        purchase_date: analyzedContent?.extracted_data?.purchase_date,
        notes: analyzedContent?.extracted_data?.notes
      },
      meta: {
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'pending',
        error: null,
        correlation_id: correlationId,
        is_original_caption: isOriginalCaption,
        original_message_id: originalMessageId,
        retry_count: 0
      }
    };

    // Create message record
    const messageData = {
      message_id: message.message_id,
      chat_id: message.chat.id,
      sender_info: message.from || message.sender_chat || {},
      message_type: determineMessageType(message),
      telegram_data: message,
      media_group_id: message.media_group_id,
      message_url: messageUrl,
      correlation_id: correlationId,
      is_original_caption: isOriginalCaption,
      original_message_id: originalMessageId,
      message_media_data: messageMediaData,
      analyzed_content: analyzedContent,
      status: 'pending',
      caption: message.caption
    };

    console.log('Creating message record:', {
      message_id: message.message_id,
      chat_id: message.chat.id,
      correlation_id: correlationId,
      is_original_caption: isOriginalCaption,
      original_message_id: originalMessageId,
      media_group_id: message.media_group_id
    });

    const { data: messageRecord, error: messageError } = await supabaseClient
      .from('messages')
      .upsert(messageData)
      .select()
      .single();

    if (messageError) {
      console.error('Error creating message:', messageError);
      throw messageError;
    }

    // Queue for processing
    const queueType = message.photo || message.video || message.document || message.animation 
      ? 'media' 
      : 'webhook';

    const { error: queueError } = await supabaseClient
      .from('unified_processing_queue')
      .insert({
        queue_type: queueType,
        data: messageMediaData,
        status: 'pending',
        correlation_id: correlationId,
        chat_id: message.chat.id,
        message_id: message.message_id,
        message_media_data: messageMediaData
      });

    if (queueError) {
      console.error('Error queueing message:', queueError);
      throw queueError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Update processed successfully',
        messageId: messageRecord.id,
        correlationId,
        queueType,
        isOriginalCaption,
        status: 'pending'
      }),
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

function determineMessageType(message: any): string {
  if (message.photo && message.photo.length > 0) return 'photo';
  if (message.video) return 'video';
  if (message.document) return 'document';
  if (message.animation) return 'animation';
  return 'unknown';
}