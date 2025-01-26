import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { caption, messageId, chatId, mediaGroupId } = await req.json()
    
    if (!caption) {
      throw new Error('Caption is required')
    }

    const webhookUrl = Deno.env.get('PABBLY_WEBHOOK_URL')
    if (!webhookUrl) {
      throw new Error('Webhook URL not configured')
    }

    console.log('Forwarding caption to external webhook:', {
      caption,
      messageId,
      chatId,
      mediaGroupId
    })

    // Forward to Pabbly webhook
    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        caption,
        messageId,
        chatId,
        mediaGroupId,
        timestamp: new Date().toISOString()
      })
    })

    if (!webhookResponse.ok) {
      throw new Error(`Webhook error: ${webhookResponse.status} ${webhookResponse.statusText}`)
    }

    const analysisResult = await webhookResponse.json()

    // Validate webhook response structure
    if (!analysisResult || typeof analysisResult !== 'object') {
      throw new Error('Invalid webhook response format')
    }

    console.log('Received analysis result:', analysisResult)

    return new Response(
      JSON.stringify({
        success: true,
        data: analysisResult
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error in analyze-caption:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        data: {
          analyzed_content: {} // Fallback empty analysis
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})