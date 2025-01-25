import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { analyzeCaptionWithAI } from "../_shared/caption-analyzer.ts";

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

    // Process each media group - only analyze caption
    for (const [groupId, groupMessages] of mediaGroups.entries()) {
      try {
        console.log(`Processing media group ${groupId} with ${groupMessages.length} messages`);
        
        // Find message with caption
        const captionMessage = groupMessages.find(m => m.caption);
        
        if (!captionMessage) {
          console.log(`No caption found for group ${groupId}`);
          continue;
        }

        // Only analyze caption
        let analyzedContent = null;
        try {
          analyzedContent = await analyzeCaptionWithAI(captionMessage.caption);
          console.log('Caption analysis result:', analyzedContent);

          // Update the message with analyzed content
          const { error: updateError } = await supabase
            .from('messages')
            .update({
              analyzed_content: analyzedContent,
              processed_at: new Date().toISOString()
            })
            .eq('id', captionMessage.id);

          if (updateError) throw updateError;

          results.processed++;
        } catch (error) {
          console.error('Error analyzing caption:', error);
          results.errors++;
          results.details.push({
            group_id: groupId,
            error: error.message
          });
        }
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
    console.error('Error in analyze media group caption:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});