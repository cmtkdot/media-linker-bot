import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { name, email } = await req.json()

    // Get the API key from Supabase secrets
    const AYD_API_KEY = Deno.env.get('AYD_API_KEY')
    if (!AYD_API_KEY) {
      throw new Error('AYD_API_KEY is not set')
    }

    const response = await fetch('https://www.askyourdatabase.com/api/chatbot/v2/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AYD_API_KEY}`,
      },
      body: JSON.stringify({
        chatbotId: 'ffa05499087f66d554e38ff4fadf4972',
        name,
        email,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to create chatbot session')
    }

    const data = await response.json()

    return new Response(
      JSON.stringify(data),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error in create-ayd-session:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})