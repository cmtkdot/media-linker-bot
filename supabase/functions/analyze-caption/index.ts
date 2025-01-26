import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

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
    const { caption } = await req.json()

    if (!caption) {
      throw new Error('Caption is required')
    }

    console.log('Analyzing caption:', caption)

    // Create analyzed content structure
    const analyzedContent = {
      raw_text: caption,
      extracted_data: {
        product_name: null,
        product_code: null,
        quantity: null,
        vendor_uid: null,
        purchase_date: null,
        notes: null
      },
      confidence: 1,
      timestamp: new Date().toISOString(),
      model_version: "direct-pass"
    }

    console.log('Analysis complete:', analyzedContent)

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
      JSON.stringify({ error: error.message }),
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