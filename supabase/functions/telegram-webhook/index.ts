import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from "../_shared/cors.ts";
import { handleWebhookUpdate } from "../_shared/webhook-handler.ts";

serve(async (req) => {
  console.log('Received webhook request:', req.method);

  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const TELEGRAM_WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_WEBHOOK_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing required environment variables');
      throw new Error('Missing required environment variables');
    }

    const webhookSecret = req.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (webhookSecret !== TELEGRAM_WEBHOOK_SECRET) {
      console.error('Invalid webhook secret received');
      return new Response(
        JSON.stringify({ error: 'Invalid webhook secret' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const update = await req.json();
    
    console.log('Processing Telegram update:', {
      update_id: update.update_id,
      message_id: update.message?.message_id,
      chat_id: update.message?.chat?.id,
      message_type: update.message?.photo ? 'photo' : 
                   update.message?.video ? 'video' : 
                   update.message?.document ? 'document' : 
                   update.message?.animation ? 'animation' : 'unknown'
    });

    const result = await handleWebhookUpdate(update, supabase, TELEGRAM_BOT_TOKEN);

    // After processing the webhook update, check for missing telegram_media records
    const message = update.message || update.channel_post;
    if (message) {
      const { data: messageRecord } = await supabase
        .from('messages')
        .select('*')
        .eq('message_id', message.message_id)
        .eq('chat_id', message.chat.id)
        .maybeSingle();

      if (messageRecord) {
        let fileId, fileUniqueId, fileType;
        if (message.photo) {
          const photo = message.photo[message.photo.length - 1];
          fileId = photo.file_id;
          fileUniqueId = photo.file_unique_id;
          fileType = 'photo';
        } else if (message.video) {
          fileId = message.video.file_id;
          fileUniqueId = message.video.file_unique_id;
          fileType = 'video';
        } else if (message.document) {
          fileId = message.document.file_id;
          fileUniqueId = message.document.file_unique_id;
          fileType = 'document';
        } else if (message.animation) {
          fileId = message.animation.file_id;
          fileUniqueId = message.animation.file_unique_id;
          fileType = 'animation';
        }

        if (fileId && fileUniqueId) {
          // Check if media record exists using file_unique_id
          const { data: existingMedia } = await supabase
            .from('telegram_media')
            .select('*')
            .eq('file_unique_id', fileUniqueId)
            .maybeSingle();

          const messageCreatedAt = new Date(messageRecord.created_at);

          if (existingMedia) {
            const mediaCreatedAt = new Date(existingMedia.created_at);
            
            // Only update if message is newer than existing media record
            if (messageCreatedAt > mediaCreatedAt) {
              console.log('Updating existing telegram_media record:', existingMedia.id);
              
              const { error: updateError } = await supabase
                .from('telegram_media')
                .update({
                  file_id: fileId,
                  message_id: messageRecord.id,
                  caption: messageRecord.caption,
                  product_name: messageRecord.product_name,
                  product_code: messageRecord.product_code,
                  quantity: messageRecord.quantity,
                  vendor_uid: messageRecord.vendor_uid,
                  purchase_date: messageRecord.purchase_date,
                  notes: messageRecord.notes,
                  analyzed_content: messageRecord.analyzed_content,
                  telegram_data: {
                    message_id: message.message_id,
                    chat_id: message.chat.id,
                    media_group_id: message.media_group_id,
                    date: message.date,
                    caption: message.caption
                  },
                  updated_at: new Date().toISOString()
                })
                .eq('id', existingMedia.id);

              if (updateError) {
                console.error('Error updating telegram_media record:', updateError);
              } else {
                console.log('Successfully updated telegram_media record:', existingMedia.id);
              }
            } else {
              console.log('Skipping update as message is older than existing media record');
            }
          } else {
            console.log('Creating new telegram_media record for message:', messageRecord.id);
            
            const { error: insertError } = await supabase
              .from('telegram_media')
              .insert({
                file_id: fileId,
                file_unique_id: fileUniqueId,
                file_type: fileType,
                message_id: messageRecord.id,
                caption: messageRecord.caption,
                product_name: messageRecord.product_name,
                product_code: messageRecord.product_code,
                quantity: messageRecord.quantity,
                vendor_uid: messageRecord.vendor_uid,
                purchase_date: messageRecord.purchase_date,
                notes: messageRecord.notes,
                analyzed_content: messageRecord.analyzed_content,
                telegram_data: {
                  message_id: message.message_id,
                  chat_id: message.chat.id,
                  media_group_id: message.media_group_id,
                  date: message.date,
                  caption: message.caption
                },
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              });

            if (insertError) {
              console.error('Error creating telegram_media record:', insertError);
            } else {
              console.log('Successfully created telegram_media record for message:', messageRecord.id);
            }
          }
        }
      }
    }
    
    console.log('Successfully processed update:', {
      update_id: update.update_id,
      message_id: update.message?.message_id,
      chat_id: update.message?.chat?.id,
      result
    });
    
    return new Response(
      JSON.stringify({ ok: true, result }),
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