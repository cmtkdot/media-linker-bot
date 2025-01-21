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
      throw new Error('Missing required environment variables');
    }

    const webhookSecret = req.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (webhookSecret !== TELEGRAM_WEBHOOK_SECRET) {
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
        return new Response(
          JSON.stringify({ message: 'No message in update' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      // Check if this is a media message
      const hasMedia = message.photo || message.video || message.document || message.animation;
      if (!hasMedia) {
        return new Response(
          JSON.stringify({ message: 'Not a media message, skipping' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      // Check for existing message to prevent duplicates
      const { data: existingMessage } = await supabase
        .from('messages')
        .select('id')
        .eq('chat_id', message.chat.id)
        .eq('message_id', message.message_id)
        .single();

      if (existingMessage) {
        return new Response(
          JSON.stringify({ message: 'Message already processed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      // Process pending updates
      const { data: pendingUpdates, error: fetchError } = await supabase
        .from('pending_webhook_updates')
        .select('*')
        .eq('status', 'pending')
        .lte('retry_count', MAX_RETRY_ATTEMPTS)
        .order('created_at', { ascending: true })
        .limit(10);

      if (fetchError) {
        throw new Error(`Error fetching pending updates: ${fetchError.message}`);
      }

      const results = [];

      for (const pendingUpdate of pendingUpdates || []) {
        try {
          const updateData: TelegramUpdate = pendingUpdate.update_data;
          const pendingMessage = updateData.message || updateData.channel_post;
          
          if (!pendingMessage) {
            await deletePendingUpdate(supabase, pendingUpdate.id);
            continue;
          }

          let productInfo = null;
          if (pendingMessage.caption) {
            productInfo = await analyzeCaption(pendingMessage.caption, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
          }

          const messageRecord = await createMessage(supabase, pendingMessage, productInfo);

          const mediaTypes = ['photo', 'video', 'document', 'animation'] as const;
          let mediaFile = null;
          let mediaType = '';

          for (const type of mediaTypes) {
            if (pendingMessage[type]) {
              mediaFile = type === 'photo' 
                ? pendingMessage[type]![pendingMessage[type]!.length - 1]
                : pendingMessage[type];
              mediaType = type;
              break;
            }
          }

          if (!mediaFile) {
            await deletePendingUpdate(supabase, pendingUpdate.id);
            continue;
          }

          await processMediaFile(
            supabase,
            mediaFile,
            mediaType,
            pendingMessage,
            messageRecord,
            TELEGRAM_BOT_TOKEN,
            productInfo
          );

          // Delete the pending update after successful processing
          await deletePendingUpdate(supabase, pendingUpdate.id);
          results.push({ id: pendingUpdate.id, status: 'success' });

        } catch (error) {
          console.error(`Error processing pending update ${pendingUpdate.id}:`, error);
          
          const newRetryCount = (pendingUpdate.retry_count || 0) + 1;
          
          if (newRetryCount >= MAX_RETRY_ATTEMPTS) {
            // Mark as failed and move to error status
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
            // Update retry count and keep status as pending
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

          results.push({ 
            id: pendingUpdate.id, 
            status: 'error', 
            error: error.message,
            retryCount: newRetryCount 
          });
        }
      }

      // Store the new update for processing
      const { error: storageError } = await supabase
        .from('pending_webhook_updates')
        .insert({
          update_data: update,
          status: 'pending'
        });

      if (storageError) {
        throw storageError;
      }

      return new Response(
        JSON.stringify({ 
          message: 'Update queued for processing',
          processedResults: results 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );

    } catch (processingError) {
      console.error('Error processing update:', processingError);
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
    // Delete updates that have exceeded retry limit and are marked as failed
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
