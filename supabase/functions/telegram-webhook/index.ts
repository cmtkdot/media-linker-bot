import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { processWebhookUpdate } from "../_shared/services/webhook/webhook-service.ts";

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

    const update = await req.json();
    const correlationId = crypto.randomUUID();

    console.log('Received webhook update:', {
      update_id: update.update_id,
      correlation_id: correlationId,
      message_id: update.message?.message_id || update.channel_post?.message_id,
      chat_id: update.message?.chat?.id || update.channel_post?.chat?.id,
      media_group_id: update.message?.media_group_id || update.channel_post?.media_group_id,
      has_photo: !!(update.message?.photo || update.channel_post?.photo),
      has_video: !!(update.message?.video || update.channel_post?.video),
      has_document: !!(update.message?.document || update.channel_post?.document),
      caption: update.message?.caption || update.channel_post?.caption
    });

    const result = await processWebhookUpdate(supabase, update, correlationId);

    return new Response(
      JSON.stringify(result),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  } catch (error) {
    console.error('Error in webhook handler:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false,
        message: 'Error processing webhook update'
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        }, 
        status: 500 
      }
    );
  }
});