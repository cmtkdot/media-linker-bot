import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withDatabaseRetry } from "../_shared/database-retry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get pending queue items
    const { data: queueItems, error: queueError } = await supabase
      .from('unified_processing_queue')
      .select('*')
      .eq('status', 'pending')
      .eq('queue_type', 'media')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(10);

    if (queueError) throw queueError;

    console.log(`Processing ${queueItems?.length || 0} queue items`);

    const results = [];
    for (const item of queueItems || []) {
      try {
        // Get message and check media group status
        const { data: message } = await supabase
          .from('messages')
          .select('*')
          .eq('id', item.correlation_id)
          .single();

        if (!message) {
          throw new Error(`Message not found: ${item.correlation_id}`);
        }

        // If part of media group, ensure all items are synced
        if (message.media_group_id) {
          const { data: groupSyncStatus } = await supabase.rpc('is_media_group_synced', {
            group_id: message.media_group_id
          });

          if (!groupSyncStatus) {
            console.log(`Skipping media group ${message.media_group_id} - not fully synced`);
            continue;
          }

          // Sync analyzed content across group
          await supabase.rpc('sync_media_group', {
            group_id: message.media_group_id,
            source_message_id: message.id
          });
        }

        // Update telegram_media record
        const { error: updateError } = await supabase
          .from('telegram_media')
          .update({
            public_url: item.data.public_url,
            processed: true,
            updated_at: new Date().toISOString(),
            message_media_data: {
              message: {
                url: message.message_url,
                media_group_id: message.media_group_id,
                caption: message.caption,
                message_id: message.message_id,
                chat_id: message.chat_id,
                date: message.telegram_data.date
              },
              sender: {
                sender_info: message.sender_info,
                chat_info: message.telegram_data.chat
              },
              analysis: {
                analyzed_content: message.analyzed_content
              },
              meta: {
                created_at: message.created_at,
                updated_at: new Date().toISOString(),
                status: 'processed',
                error: null
              },
              media: {
                file_id: item.data.file_id,
                file_unique_id: item.data.file_unique_id,
                file_type: item.data.file_type,
                public_url: item.data.public_url
              }
            }
          })
          .eq('file_unique_id', item.data.file_unique_id);

        if (updateError) throw updateError;

        // Mark queue item as processed
        const { error: queueUpdateError } = await supabase
          .from('unified_processing_queue')
          .update({
            status: 'processed',
            processed_at: new Date().toISOString()
          })
          .eq('id', item.id);

        if (queueUpdateError) throw queueUpdateError;

        results.push({
          queue_item_id: item.id,
          status: 'processed',
          file_unique_id: item.data.file_unique_id
        });

      } catch (error) {
        console.error(`Error processing queue item ${item.id}:`, error);
        
        // Update queue item with error
        await supabase
          .from('unified_processing_queue')
          .update({
            status: 'error',
            error_message: error.message,
            retry_count: (item.retry_count || 0) + 1
          })
          .eq('id', item.id);

        results.push({
          queue_item_id: item.id,
          status: 'error',
          error: error.message
        });
      }
    }

    return new Response(
      JSON.stringify({ processed: results.length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing queue:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});