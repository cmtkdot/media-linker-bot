import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PABBLY_WEBHOOK_URL = "https://connect.pabbly.com/workflow/sendwebhookdata/IjU3NjYwNTZlMDYzNDA0MzU1MjY5NTUzYzUxMzci_pc"

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

    console.log('Forwarding caption to external webhook:', {
      caption,
      messageId,
      chatId,
      mediaGroupId
    })

    // Forward to Pabbly webhook
    const webhookResponse = await fetch(PABBLY_WEBHOOK_URL, {
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
      throw new Error(`Webhook error: ${webhookResponse.statusText}`)
    }

    const analyzedContent = await webhookResponse.json()

    console.log('Received analyzed content:', analyzedContent)

    // Validate the response structure
    if (!analyzedContent.extracted_data) {
      throw new Error('Invalid response structure from webhook')
    }

    return new Response(
      JSON.stringify(analyzedContent),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )

  } catch (error) {
    console.error('Error in analyze-caption:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        fallback: {
          raw_text: caption,
          extracted_data: {
            product_name: null,
            product_code: null,
            quantity: null,
            vendor_uid: null,
            purchase_date: null,
            notes: null
          },
          confidence: 0,
          timestamp: new Date().toISOString(),
          model_version: "fallback"
        }
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 400
      }
    )
  }
})