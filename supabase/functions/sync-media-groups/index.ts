import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { analyzeCaptionWithAI } from "../_shared/caption-analyzer.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { withDatabaseRetry } from "../_shared/database-retry.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get unprocessed messages with media groups
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .is('processed_at', null)
      .not('media_group_id', 'is', null)
      .order('created_at', { ascending: true });

    if (messagesError) throw messagesError;

    const results = {
      processed: 0,
      errors: 0,
      details: []
    };

    // Group messages by media_group_id
    const mediaGroups = new Map();
    for (const message of messages) {
      const groupId = message.media_group_id;
      if (!mediaGroups.has(groupId)) {
        mediaGroups.set(groupId, []);
      }
      mediaGroups.get(groupId).push(message);
    }

    // Process each media group
    for (const [groupId, groupMessages] of mediaGroups.entries()) {
      try {
        console.log(`Processing media group ${groupId} with ${groupMessages.length} messages`);
        
        // Find message with caption
        const captionMessage = groupMessages.find(m => m.caption);
        
        if (!captionMessage) {
          console.log(`No caption found for group ${groupId}`);
          continue;
        }

        // Queue all messages in group for processing
        for (const message of groupMessages) {
          await withDatabaseRetry(async () => {
            const { error: queueError } = await supabase
              .from('unified_processing_queue')
              .insert({
                queue_type: 'media',
                data: {
                  message: {
                    url: message.message_url,
                    media_group_id: groupId,
                    caption: captionMessage.caption,
                    message_id: message.message_id,
                    chat_id: message.chat_id,
                    date: message.telegram_data.date
                  },
                  sender: {
                    sender_info: message.sender_info,
                    chat_info: message.telegram_data.chat
                  },
                  telegram_data: message.telegram_data
                },
                status: 'pending',
                chat_id: message.chat_id,
                message_id: message.message_id,
                correlation_id: message.id,
                priority: 1
              });

            if (queueError) throw queueError;
          });

          // Mark message as processed
          await withDatabaseRetry(async () => {
            const { error: updateError } = await supabase
              .from('messages')
              .update({
                processed_at: new Date().toISOString()
              })
              .eq('id', message.id);

            if (updateError) throw updateError;
          });
        }

        results.processed++;
      } catch (error) {
        console.error(`Error processing group ${groupId}:`, error);
        results.errors++;
        results.details.push({
          group_id: groupId,
          error: error.message
        });
      }
    }

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in sync media groups:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});