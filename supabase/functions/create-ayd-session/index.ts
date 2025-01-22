import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, email } = await req.json();

    // Get the API key from Supabase secrets
    const AYD_API_KEY = Deno.env.get('AYD_API_KEY');
    if (!AYD_API_KEY) {
      throw new Error('AYD_API_KEY is not set');
    }

    console.log('Creating chatbot session for:', { name, email });

    const response = await fetch('https://www.askyourdatabase.com/api/chatbot/v2/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AYD_API_KEY}`,
      },
      body: JSON.stringify({
        chatbotid: 'ffa05499087f66d554e38ff4fadf4972', // Changed from chatbotId to chatbotid
        name,
        email,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AYD API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`AYD API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log('Chatbot session created:', data);

    return new Response(
      JSON.stringify(data),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    console.error('Error in create-ayd-session:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    );
  }
});