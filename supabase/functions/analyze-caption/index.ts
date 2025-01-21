import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables')
    }

    const { caption, mediaGroupId } = await req.json()
    
    if (!caption) {
      return new Response(
        JSON.stringify({ error: 'Caption is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    console.log('Analyzing caption:', caption)

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Extract product information from captions, it often follows the format: "{Product Name} #{PurchaseCode} x {Quantity}". 
            The PurchaseCode consists of a VendorUID which is the text characters from the caption PurchaseCode followed by the Purchase Date in mmDDYY format.
            Return a JSON object with:
            - product_name: which is the product name from the caption for the cannabis product
            - product_code: which is the code from the caption that is started with # and followed by the PurchaseCode
            - quantity: which is the quantity from the caption for the product often followed by the word "x"
            - vendor_uid which is the vendor uid from the caption that are text characters from the PurchaseCode
            - purchase_date (convert mmDDYY to MM/DD/YYYY format) which is the purchase date from the caption
            
            Example caption: "Cherry Blow Pop #FISH011625 x 3"
            Example response: {
              "product_name": "Cherry Blow Pop",
              "product_code": "FISH011625",
              "quantity": 3,
              "vendor_uid": "FISH",
              "purchase_date": "01/16/2025"
            }
            If any part is missing, set it to null.`
          },
          {
            role: 'user',
            content: caption
          }
        ],
        temperature: 0.1
      }),
    })

    const data = await response.json()
    const result = JSON.parse(data.choices[0].message.content)

    console.log('AI Analysis result:', result)

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Convert MM/DD/YYYY to YYYY-MM-DD for database storage
    let dbPurchaseDate = null
    if (result.purchase_date) {
      const [month, day, year] = result.purchase_date.split('/')
      dbPurchaseDate = `${year}-${month}-${day}`
    }

    // Update all media items in the same group
    if (mediaGroupId) {
      const { error: updateError } = await supabase
        .from('telegram_media')
        .update({
          caption: caption,
          product_name: result.product_name,
          product_code: result.product_code,
          quantity: result.quantity,
          vendor_uid: result.vendor_uid,
          purchase_date: dbPurchaseDate
        })
        .eq('telegram_data->media_group_id', mediaGroupId)

      if (updateError) {
        console.error('Error updating media group:', updateError)
        throw updateError
      }

      console.log('Successfully updated all media in group:', mediaGroupId)
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error analyzing caption:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})