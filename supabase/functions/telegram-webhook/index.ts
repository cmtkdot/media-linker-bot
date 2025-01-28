import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { processMessageContent } from "../_shared/message-group-sync.ts";

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

    // Handle original caption logic for media groups
    let isOriginalCaption = false;
    let originalMessageId = null;

    if (message.media_group_id) {
      console.log('Processing media group message:', {
        media_group_id: message.media_group_id,
        message_id: message.message_id,
        has_caption: !!message.caption,
        correlation_id: correlationId
      });

      // Check if this message has a caption
      if (message.caption) {
        // Check if there's already a message with caption in this group
        const { data: existingCaptionHolder } = await supabaseClient
          .from('messages')
          .select('id')
          .eq('media_group_id', message.media_group_id)
          .eq('is_original_caption', true)
          .maybeSingle();

        if (!existingCaptionHolder) {
          // This is the first message with caption in the group
          isOriginalCaption = true;
        } else {
          // There's already a caption holder, reference it
          originalMessageId = existingCaptionHolder.id;
        }
      }
    } else if (message.caption) {
      // Single message with caption is always original
      isOriginalCaption = true;
    }

    // Process message content and get analyzed content immediately
    const { analyzedContent, messageStatus, productInfo } = await processMessageContent(
      supabaseClient,
      message,
      correlationId
    );

    // Extract raw text from caption or analyzed content
    const rawText = analyzedContent?.raw_text || message.caption || null;

    // Prepare message data with original caption info and raw text
    const messageData = {
      message_id: message.message_id,
      chat_id: message.chat.id,
      sender_info: message.from || message.sender_chat || {},
      message_type: determineMessageType(message),
      telegram_data: message,
      media_group_id: message.media_group_id,
      message_url: messageUrl,
      correlation_id: correlationId,
      analyzed_content: analyzedContent,
      status: messageStatus,
      is_original_caption: isOriginalCaption,
      original_message_id: originalMessageId,
      raw_text: rawText,
      ...productInfo
    };

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
        chat_info: message.chat
      },
      analysis: {
        analyzed_content: analyzedContent
      },
      meta: {
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: messageStatus,
        is_original_caption: isOriginalCaption,
        original_message_id: originalMessageId,
        raw_text: rawText
      }
    };

    // Create or update message record
    const { data: messageRecord, error: messageError } = await supabaseClient
      .from('messages')
      .upsert({
        ...messageData,
        message_media_data: messageMediaData
      })
      .select()
      .single();

    if (messageError) {
      console.error('Error creating/updating message:', {
        error: messageError,
        media_group_id: message.media_group_id,
        message_id: message.message_id,
        correlation_id: correlationId
      });
      throw messageError;
    }

    // If this is a media group message, ensure all messages in group are properly linked
    if (message.media_group_id && messageRecord && isOriginalCaption) {
      console.log('Syncing media group messages:', {
        media_group_id: message.media_group_id,
        current_message_id: messageRecord.id,
        correlation_id: correlationId
      });

      // Update all messages in the group with shared analyzed content
      if (analyzedContent) {
        const { error: groupUpdateError } = await supabaseClient
          .from('messages')
          .update({
            analyzed_content: analyzedContent,
            status: 'processed',
            original_message_id: messageRecord.id,
            raw_text: rawText,
            ...productInfo
          })
          .eq('media_group_id', message.media_group_id)
          .neq('id', messageRecord.id);

        if (groupUpdateError) {
          console.error('Error updating media group:', {
            error: groupUpdateError,
            media_group_id: message.media_group_id,
            correlation_id: correlationId
          });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Message processed successfully',
        messageId: messageRecord?.id,
        correlationId,
        status: messageRecord?.status,
        mediaGroupId: message.media_group_id,
        isOriginalCaption,
        originalMessageId,
        rawText
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