import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const AYD_API_KEY = Deno.env.get('AYD_API_KEY')
    if (!AYD_API_KEY) {
      throw new Error('AYD_API_KEY is not set')
    }

    // Get request body
    const body = await req.json()
    console.log('Creating AYD session with body:', body)

    // Make request to AYD API with better error handling
    const response = await fetch('https://api.ayd.ai/v1/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AYD_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    }).catch(error => {
      console.error('Network error when calling AYD API:', error);
      throw new Error(`Failed to connect to AYD API: ${error.message}`);
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AYD API error response:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error(`AYD API responded with status ${response.status}: ${errorText}`);
    }

    const data = await response.json()
    console.log('AYD API response:', data)

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: response.status
    })

  } catch (error) {
    console.error('Error in create-ayd-session:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack
      }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})