import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    if (!messageId || !chatId) {
      throw new Error('Missing required parameters: messageId and chatId');
    }

    // First verify the message exists and get its current content
    const getMessageUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChat`;
    const chatResponse = await fetch(getMessageUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
      }),
    });

    if (!chatResponse.ok) {
      console.error('Failed to verify chat:', await chatResponse.text());
      throw new Error('Failed to verify chat exists');
    }

    // Get current message content
    const getCurrentMessageUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMessage`;
    const currentMessageResponse = await fetch(getCurrentMessageUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
      }),
    });

    const currentMessage = await currentMessageResponse.json();
    
    // Check if the content is actually different
    if (currentMessage.ok && 
        currentMessage.result.caption === updates.caption) {
      console.log('Message content unchanged, skipping update');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No update needed - content unchanged' 
        }),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    // Prepare the update data
    const updateData: Record<string, any> = {
      chat_id: chatId,
      message_id: messageId,
    };

    // Handle caption updates
    if (updates.caption !== undefined) {
      updateData.caption = updates.caption;
    }

    console.log('Sending update to Telegram:', updateData);

    // Send update to Telegram
    const editUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageCaption`;
    const updateResponse = await fetch(editUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
    });

    const result = await updateResponse.json();
    
    if (!updateResponse.ok) {
      // Handle "message not modified" error gracefully
      if (result.description?.includes('message is not modified')) {
        console.log('Message content unchanged (caught from Telegram response)');
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'No update needed - content unchanged' 
          }),
          { 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json' 
            } 
          }
        );
      }
      
      console.error('Telegram API error:', result);
      throw new Error(`Failed to update message: ${result.description || updateResponse.statusText}`);
    }

    console.log('Update successful:', result);

    return new Response(
      JSON.stringify({ success: true, result }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Error in update-telegram-message:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack 
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