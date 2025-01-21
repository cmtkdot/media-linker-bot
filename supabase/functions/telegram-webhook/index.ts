import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from "../_shared/cors.ts"
import { TelegramUpdate } from "../_shared/telegram-types.ts"
import { analyzeCaption } from "../_shared/telegram-service.ts"
import { createMessage, processMediaFile } from "../_shared/database-service.ts"

const MAX_RETRY_ATTEMPTS = 3;

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
      console.error('Missing required environment variables');
      throw new Error('Missing required environment variables');
    }

    const webhookSecret = req.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (webhookSecret !== TELEGRAM_WEBHOOK_SECRET) {
      console.error('Invalid webhook secret');
      return new Response(
        JSON.stringify({ error: 'Invalid webhook secret' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const update: TelegramUpdate = await req.json();
    console.log('Received Telegram update:', JSON.stringify(update));

    try {
      const message = update.message || update.channel_post;
      if (!message) {
        console.log('No message in update');
        return new Response(
          JSON.stringify({ message: 'No message in update' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      // Check if this is a media message
      const hasMedia = message.photo || message.video || message.document || message.animation;
      if (!hasMedia) {
        console.log('Not a media message, skipping');
        return new Response(
          JSON.stringify({ message: 'Not a media message, skipping' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      // Check for existing message to prevent duplicates
      console.log('Checking for existing message:', message.chat.id, message.message_id);
      const { data: existingMessage } = await supabase
        .from('messages')
        .select('id')
        .eq('chat_id', message.chat.id)
        .eq('message_id', message.message_id)
        .maybeSingle();

      if (existingMessage) {
        console.log('Message already processed:', existingMessage);
        return new Response(
          JSON.stringify({ message: 'Message already processed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      let productInfo = null;
      if (message.caption) {
        console.log('Analyzing caption:', message.caption);
        productInfo = await analyzeCaption(message.caption, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      }

      console.log('Creating message record with product info:', productInfo);
      const messageRecord = await createMessage(supabase, message, productInfo);

      const mediaTypes = ['photo', 'video', 'document', 'animation'] as const;
      let mediaFile = null;
      let mediaType = '';

      for (const type of mediaTypes) {
        if (message[type]) {
          mediaFile = type === 'photo' 
            ? message[type]![message[type]!.length - 1]
            : message[type];
          mediaType = type;
          break;
        }
      }

      if (!mediaFile) {
        console.error('No media file found in message');
        throw new Error('No media file found in message');
      }

      console.log('Processing media file:', mediaFile.file_id, 'type:', mediaType);
      await processMediaFile(
        supabase,
        mediaFile,
        mediaType,
        message,
        messageRecord,
        TELEGRAM_BOT_TOKEN,
        productInfo
      );

      // Update status to success after successful processing
      const { error: updateError } = await supabase
        .from('pending_webhook_updates')
        .update({ 
          status: 'success',
          updated_at: new Date().toISOString()
        })
        .eq('update_data->message->message_id', message.message_id)
        .eq('update_data->message->chat->id', message.chat.id);

      if (updateError) {
        console.error('Error updating webhook status:', updateError);
      }

      return new Response(
        JSON.stringify({ 
          message: 'Media processed successfully',
          messageId: messageRecord.id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );

    } catch (processingError) {
      console.error('Error processing update:', processingError);
      
      // Get current retry count for this update
      const { data: existingUpdate } = await supabase
        .from('pending_webhook_updates')
        .select('retry_count, id')
        .eq('update_data->message->message_id', update.message?.message_id)
        .eq('update_data->message->chat->id', update.message?.chat.id)
        .maybeSingle();

      const currentRetryCount = existingUpdate?.retry_count || 0;
      const newStatus = currentRetryCount >= MAX_RETRY_ATTEMPTS - 1 ? 'failed' : 'pending';
      
      // Store or update the failed update for retry
      const updateData = {
        update_data: update,
        status: newStatus,
        retry_count: currentRetryCount + 1,
        error_message: processingError.message,
        last_retry_at: new Date().toISOString()
      };

      const { error: storageError } = existingUpdate 
        ? await supabase
            .from('pending_webhook_updates')
            .update(updateData)
            .eq('id', existingUpdate.id)
        : await supabase
            .from('pending_webhook_updates')
            .insert(updateData);

      if (storageError) {
        console.error('Error storing pending update:', storageError);
      }

      throw processingError;
    }

  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});