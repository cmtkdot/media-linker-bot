import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
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

    // Extract product information from analyzed content
    const productInfo = analyzedContent ? {
      product_name: analyzedContent.product_name,
      product_code: analyzedContent.product_code,
      quantity: analyzedContent.quantity,
      vendor_uid: analyzedContent.vendor_uid,
      purchase_date: analyzedContent.purchase_date,
      notes: analyzedContent.notes
    } : null;

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
      // Only set status to pending if we have required data
      status: (analyzedContent?.product_name || message.media_group_id) ? 'pending' : 'incomplete',
      ...productInfo
    };

    // If part of a media group, sync analyzed content to all messages in group
    if (message.media_group_id && analyzedContent) {
      console.log('Syncing analyzed content to media group:', {
        media_group_id: message.media_group_id,
        correlation_id: correlationId
      });

      const { error: groupUpdateError } = await supabaseClient
        .from('messages')
        .update({
          analyzed_content: analyzedContent,
          product_name: productInfo?.product_name,
          product_code: productInfo?.product_code,
          quantity: productInfo?.quantity,
          vendor_uid: productInfo?.vendor_uid,
          purchase_date: productInfo?.purchase_date,
          notes: productInfo?.notes,
          status: 'pending'
        })
        .eq('media_group_id', message.media_group_id);

      if (groupUpdateError) {
        console.error('Error updating media group:', groupUpdateError);
      }
    }

    // Create or update message record
    const { data: existingMessage } = await supabaseClient
      .from('messages')
      .select('id, media_group_id, analyzed_content')
      .eq('message_id', message.message_id)
      .eq('chat_id', message.chat.id)
      .maybeSingle();

    let messageRecord;
    
    if (existingMessage) {
      // If message exists in a group and has analyzed content, use that
      if (!analyzedContent && existingMessage.media_group_id) {
        const { data: groupMessage } = await supabaseClient
          .from('messages')
          .select('analyzed_content, product_name, product_code, quantity, vendor_uid, purchase_date, notes')
          .eq('media_group_id', existingMessage.media_group_id)
          .not('analyzed_content', 'is', null)
          .maybeSingle();

        if (groupMessage) {
          messageData.analyzed_content = groupMessage.analyzed_content;
          messageData.product_name = groupMessage.product_name;
          messageData.product_code = groupMessage.product_code;
          messageData.quantity = groupMessage.quantity;
          messageData.vendor_uid = groupMessage.vendor_uid;
          messageData.purchase_date = groupMessage.purchase_date;
          messageData.notes = groupMessage.notes;
          messageData.status = 'pending';
        }
      }

      const { data, error: updateError } = await supabaseClient
        .from('messages')
        .update(messageData)
        .eq('id', existingMessage.id)
        .select()
        .single();

      if (updateError) throw updateError;
      messageRecord = data;
    } else {
      // For new messages in a group, check if group has analyzed content
      if (!analyzedContent && message.media_group_id) {
        const { data: groupMessage } = await supabaseClient
          .from('messages')
          .select('analyzed_content, product_name, product_code, quantity, vendor_uid, purchase_date, notes')
          .eq('media_group_id', message.media_group_id)
          .not('analyzed_content', 'is', null)
          .maybeSingle();

        if (groupMessage) {
          messageData.analyzed_content = groupMessage.analyzed_content;
          messageData.product_name = groupMessage.product_name;
          messageData.product_code = groupMessage.product_code;
          messageData.quantity = groupMessage.quantity;
          messageData.vendor_uid = groupMessage.vendor_uid;
          messageData.purchase_date = groupMessage.purchase_date;
          messageData.notes = groupMessage.notes;
          messageData.status = 'pending';
        }
      }

      const { data, error: insertError } = await supabaseClient
        .from('messages')
        .insert([messageData])
        .select()
        .single();

      if (insertError) throw insertError;
      messageRecord = data;
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
        status: messageRecord?.status
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