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

    // Log incoming media group message
    if (message.media_group_id) {
      console.log('Processing media group message:', {
        media_group_id: message.media_group_id,
        message_id: message.message_id,
        has_caption: !!message.caption,
        photo_count: message.photo?.length || 0,
        correlation_id: correlationId
      });
    }

    // Process message content and get analyzed content immediately
    const { analyzedContent, messageStatus, productInfo } = await processMessageContent(
      supabaseClient,
      message,
      correlationId
    );

    // Check for existing media group messages
    let existingGroupMessages = [];
    if (message.media_group_id) {
      const { data: groupMessages } = await supabaseClient
        .from('messages')
        .select('*')
        .eq('media_group_id', message.media_group_id)
        .order('created_at', { ascending: true });
      
      existingGroupMessages = groupMessages || [];
      
      console.log('Found existing group messages:', {
        media_group_id: message.media_group_id,
        existing_count: existingGroupMessages.length,
        correlation_id: correlationId
      });
    }

    // Prepare message data
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
      ...productInfo
    };

    // Create or update message record
    const { data: messageRecord, error: messageError } = await supabaseClient
      .from('messages')
      .upsert(messageData)
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
    if (message.media_group_id && messageRecord) {
      console.log('Syncing media group messages:', {
        media_group_id: message.media_group_id,
        current_message_id: messageRecord.id,
        existing_count: existingGroupMessages.length,
        correlation_id: correlationId
      });

      // Update all messages in the group with shared analyzed content
      if (analyzedContent) {
        const { error: groupUpdateError } = await supabaseClient
          .from('messages')
          .update({
            analyzed_content: analyzedContent,
            status: 'processed',
            ...productInfo
          })
          .eq('media_group_id', message.media_group_id);

        if (groupUpdateError) {
          console.error('Error updating media group:', {
            error: groupUpdateError,
            media_group_id: message.media_group_id,
            correlation_id: correlationId
          });
        }
      }
    }

    console.log('Message record created/updated:', {
      record_id: messageRecord?.id,
      correlation_id: correlationId,
      status: messageRecord?.status,
      has_analyzed_content: !!messageRecord?.analyzed_content,
      media_group_id: messageRecord?.media_group_id
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Message processed successfully',
        messageId: messageRecord?.id,
        correlationId,
        status: messageRecord?.status,
        mediaGroupId: message.media_group_id,
        groupSize: existingGroupMessages.length + 1
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