import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { name, email } = await req.json();
    
    if (!name || !email) {
      throw new Error('Name and email are required');
    }

    const AYD_API_KEY = Deno.env.get('AYD_API_KEY');
    if (!AYD_API_KEY) {
      throw new Error('AYD_API_KEY is not configured');
    }

    console.log('Creating AYD session for:', { name, email });

    const response = await fetch('https://api.askyourdata.com/v1/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AYD_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, email })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('AYD API error:', error);
      throw new Error(`Failed to create session: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('AYD session created successfully');
    
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in create-ayd-session:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});