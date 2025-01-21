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

    const { caption, mediaGroupId, messageId, telegramMediaId } = await req.json()
    
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
            content: `Extract product information from captions following these rules:

            1. product_name: Product name from caption
            2. product_code: Code after # (without the #)
            3. quantity: Number after "x" (if present), ignore anything in () which should be added to notes or if there a space or anything after the quantity that should be in notes too. example Candy Paint #FISH011425 x 3 (20 behind) should be quantity of 3              
            4. vendor_uid: Letters before numbers in the code
            5. purchase_date: Convert 6 digits from code (mmDDyy) to YYYY-MM-DD
            6. notes: Any text in parentheses or text that is not part of the product name, product code, purchase date, vendor uid, or quantity

            Date format in code:
            - First 2 digits = month
            - Next 2 digits = day
            - Last 2 digits = year (assume 2024)

            Return a JSON object with:
            - product_name: string or null
            - product_code: string or null
            - quantity: number or null 
            - vendor_uid: string or null
            - purchase_date: string or null (in YYYY-MM-DD format)
            - notes: string or null 
            - raw_caption: the original caption
            - analyzed_at: current timestamp in ISO format
            - confidence_score: number between 0 and 1 indicating how confident you are in the analysis

            Example caption: "Runtz Q #Q112124 x 1 (50 behind)"
            Example response: {
              "product_name": "Runtz Q",
              "product_code": "Q112124",
              "quantity": 1,
              "vendor_uid": "Q",
              "purchase_date": "2024-11-21",
              "notes": "50 behind",
              "raw_caption": "Runtz Q #Q112124 x 1 (50 behind)",
              "analyzed_at": "2024-01-21T08:13:21.830Z",
              "confidence_score": 0.95
            }

            If any part cannot be extracted, set it to null.`
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
    console.log('AI Analysis result:', data)
    
    const result = JSON.parse(data.choices[0].message.content)
    console.log('Parsed result:', result)

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Update the messages table if messageId is provided
    if (messageId) {
      const { error: messageError } = await supabase
        .from('messages')
        .update({
          caption: caption,
          product_name: result.product_name,
          product_code: result.product_code,
          quantity: result.quantity,
          vendor_uid: result.vendor_uid,
          purchase_date: result.purchase_date,
          notes: result.notes,
          analyzed_content: result
        })
        .eq('id', messageId)

      if (messageError) {
        console.error('Error updating message:', messageError)
      }
    }

    // Update telegram_media table
    const mediaQuery = supabase
      .from('telegram_media')
      .update({
        caption: caption,
        product_name: result.product_name,
        product_code: result.product_code,
        quantity: result.quantity,
        vendor_uid: result.vendor_uid,
        purchase_date: result.purchase_date,
        notes: result.notes,
        analyzed_content: result
      })

    // If we have a specific media ID, update just that record
    if (telegramMediaId) {
      mediaQuery.eq('id', telegramMediaId)
    } 
    // If we have a media group ID, update all media in the group
    else if (mediaGroupId) {
      mediaQuery.eq('telegram_data->media_group_id', mediaGroupId)
    }

    const { error: mediaError } = await mediaQuery

    if (mediaError) {
      console.error('Error updating media:', mediaError)
      throw mediaError
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