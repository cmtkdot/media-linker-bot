import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!TELEGRAM_BOT_TOKEN) {
      throw new Error('Missing TELEGRAM_BOT_TOKEN');
    }

    const { messageId, chatId, updates } = await req.json();

    console.log('Received update request:', {
      messageId,
      chatId,
      updates
    });

    // Fetch existing message from Telegram to get current state
    const getMessageUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMessage`;
    const messageResponse = await fetch(getMessageUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
      }),
    });

    if (!messageResponse.ok) {
      throw new Error(`Failed to get message: ${messageResponse.statusText}`);
    }

    const message = await messageResponse.json();
    console.log('Current message state:', message);

    // Prepare the update data
    const updateData: Record<string, any> = {};

    // Handle caption updates
    if (updates.caption !== undefined) {
      updateData.caption = updates.caption;
    }

    // Add other update fields as needed
    if (Object.keys(updateData).length === 0) {
      return new Response(
        JSON.stringify({ message: 'No updates to apply' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send update to Telegram
    const editUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageCaption`;
    const updateResponse = await fetch(editUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        ...updateData,
      }),
    });

    if (!updateResponse.ok) {
      const error = await updateResponse.json();
      console.error('Telegram API error:', error);
      throw new Error(`Failed to update message: ${updateResponse.statusText}`);
    }

    const result = await updateResponse.json();
    console.log('Update result:', result);

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in update-telegram-message:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});