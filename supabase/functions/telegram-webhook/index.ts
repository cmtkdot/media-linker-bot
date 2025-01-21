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

    // Clean up old failed attempts that exceeded retry limit
    await cleanupFailedAttempts(supabase);

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

      // Process any pending updates
      await processPendingUpdates(supabase, TELEGRAM_BOT_TOKEN);

      return new Response(
        JSON.stringify({ 
          message: 'Media processed successfully',
          messageId: messageRecord.id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );

    } catch (processingError) {
      console.error('Error processing update:', processingError);
      
      // Store the failed update for retry
      const { error: storageError } = await supabase
        .from('pending_webhook_updates')
        .insert({
          update_data: update,
          status: 'pending',
          error_message: processingError.message
        });

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

async function processPendingUpdates(supabase: any, botToken: string) {
  console.log('Processing pending updates');
  const { data: pendingUpdates, error: fetchError } = await supabase
    .from('pending_webhook_updates')
    .select('*')
    .eq('status', 'pending')
    .lte('retry_count', MAX_RETRY_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(10);

  if (fetchError) {
    console.error('Error fetching pending updates:', fetchError);
    return;
  }

  for (const pendingUpdate of pendingUpdates || []) {
    try {
      console.log('Processing pending update:', pendingUpdate.id);
      const updateData: TelegramUpdate = pendingUpdate.update_data;
      const message = updateData.message || updateData.channel_post;
      
      if (!message) {
        console.log('No message in pending update, deleting:', pendingUpdate.id);
        await deletePendingUpdate(supabase, pendingUpdate.id);
        continue;
      }

      let productInfo = null;
      if (message.caption) {
        productInfo = await analyzeCaption(message.caption, supabase.supabaseUrl, supabase.supabaseKey);
      }

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
        console.log('No media file in pending update, deleting:', pendingUpdate.id);
        await deletePendingUpdate(supabase, pendingUpdate.id);
        continue;
      }

      await processMediaFile(
        supabase,
        mediaFile,
        mediaType,
        message,
        messageRecord,
        botToken,
        productInfo
      );

      console.log('Successfully processed pending update:', pendingUpdate.id);
      await deletePendingUpdate(supabase, pendingUpdate.id);

    } catch (error) {
      console.error(`Error processing pending update ${pendingUpdate.id}:`, error);
      
      const newRetryCount = (pendingUpdate.retry_count || 0) + 1;
      
      if (newRetryCount >= MAX_RETRY_ATTEMPTS) {
        console.log(`Update ${pendingUpdate.id} exceeded retry limit, marking as failed`);
        const { error: updateError } = await supabase
          .from('pending_webhook_updates')
          .update({
            retry_count: newRetryCount,
            last_retry_at: new Date().toISOString(),
            error_message: error.message,
            status: 'failed'
          })
          .eq('id', pendingUpdate.id);

        if (updateError) {
          console.error('Error updating retry information:', updateError);
        }
      } else {
        console.log(`Updating retry count for update ${pendingUpdate.id} to ${newRetryCount}`);
        const { error: updateError } = await supabase
          .from('pending_webhook_updates')
          .update({
            retry_count: newRetryCount,
            last_retry_at: new Date().toISOString(),
            error_message: error.message
          })
          .eq('id', pendingUpdate.id);

        if (updateError) {
          console.error('Error updating retry information:', updateError);
        }
      }
    }
  }
}

async function deletePendingUpdate(supabase: any, updateId: string) {
  const { error } = await supabase
    .from('pending_webhook_updates')
    .delete()
    .eq('id', updateId);

  if (error) {
    console.error('Error deleting pending update:', error);
    throw error;
  }
}

async function cleanupFailedAttempts(supabase: any) {
  try {
    console.log('Cleaning up failed attempts');
    const { error } = await supabase
      .from('pending_webhook_updates')
      .delete()
      .eq('status', 'failed')
      .gt('retry_count', MAX_RETRY_ATTEMPTS);

    if (error) {
      console.error('Error cleaning up failed attempts:', error);
    }
  } catch (error) {
    console.error('Error in cleanup process:', error);
  }
}