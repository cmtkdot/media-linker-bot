import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from "../_shared/cors.ts"
import { TelegramUpdate } from "../_shared/telegram-types.ts"
import { analyzeCaption } from "../_shared/telegram-service.ts"
import { createMessage, processMediaFile } from "../_shared/database-service.ts"

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

    // Get pending updates
    const { data: pendingUpdates, error: fetchError } = await supabase
      .from('pending_webhook_updates')
      .select('*')
      .eq('status', 'pending')
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
          await markUpdateProcessed(supabase, pendingUpdate.id, 'No message in update');
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
          await markUpdateProcessed(supabase, pendingUpdate.id, 'No media to process');
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

        await markUpdateProcessed(supabase, pendingUpdate.id);
        results.push({ id: pendingUpdate.id, status: 'success' });

      } catch (error) {
        console.error(`Error processing pending update ${pendingUpdate.id}:`, error);
        
        // Update retry count and last retry timestamp
        const { error: updateError } = await supabase
          .from('pending_webhook_updates')
          .update({
            retry_count: (pendingUpdate.retry_count || 0) + 1,
            last_retry_at: new Date().toISOString(),
            error_message: error.message
          })
          .eq('id', pendingUpdate.id);

        if (updateError) {
          console.error('Error updating retry information:', updateError);
        }

        results.push({ id: pendingUpdate.id, status: 'error', error: error.message });
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

async function markUpdateProcessed(supabase: any, updateId: string, message?: string) {
  const { error } = await supabase
    .from('pending_webhook_updates')
    .update({
      status: 'processed',
      error_message: message || null
    })
    .eq('id', updateId);

  if (error) {
    console.error('Error marking update as processed:', error);
  }
}