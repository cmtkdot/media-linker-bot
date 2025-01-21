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
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!TELEGRAM_BOT_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Clean up old failed attempts that exceeded retry limit
    await cleanupFailedAttempts(supabase);

    // Get pending updates
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
        const update: TelegramUpdate = pendingUpdate.update_data;
        const message = update.message || update.channel_post;
        
        if (!message) {
          await deletePendingUpdate(supabase, pendingUpdate.id);
          continue;
        }

        let productInfo = null;
        if (message.caption) {
          productInfo = await analyzeCaption(message.caption, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
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
          await deletePendingUpdate(supabase, pendingUpdate.id);
          continue;
        }

        await processMediaFile(
          supabase,
          mediaFile,
          mediaType,
          message,
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

    return new Response(
      JSON.stringify({ message: 'Retry process completed', results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error in retry process:', error);
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
