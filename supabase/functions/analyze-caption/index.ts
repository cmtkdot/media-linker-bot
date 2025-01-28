import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { OpenAI } from "https://esm.sh/openai@4.28.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SYSTEM_PROMPT = `You are a specialized AI trained to extract cannabis product information from text strings.
Given a string containing cannabis product information, extract and structure the data according to these rules:

INPUT FORMAT:
Product entries follow pattern: "[Product Name] #[Vendor_UID][Date] x [Quantity] ([Notes])"

EXTRACTION RULES:
1. Product Name: Text before '#' or 'x', required
2. Product Code: Starts with '#', includes vendor UID and date
3. Vendor UID: 1-4 uppercase letters after '#' (e.g., CARL, FISH)
4. Purchase Date: After vendor UID, format YYYY-MM-DD
5. Quantity: Number after 'x'
6. Notes: Text in parentheses or unmatched info

Handle special cases:
- Missing hashtag
- Multiple quantities
- Multiple notes (join with semicolon)
- Irregular spacing
- Missing information (use null)

Return ONLY a JSON object with this exact structure:
{
  "analyzed_content": {
    "product_info": {
      "product_name": string,
      "product_code": string | null,
      "vendor_uid": string | null,
      "purchase_date": string | null,
      "quantity": number | null,
      "notes": string | null
    }
  }
}`

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { caption } = await req.json()
    
    if (!caption) {
      console.log('No caption provided, returning empty analysis')
      return new Response(
        JSON.stringify({
          analyzed_content: {
            product_info: {
              product_name: null,
              product_code: null,
              vendor_uid: null,
              purchase_date: null,
              quantity: null,
              notes: null
            }
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const openai = new OpenAI({
      apiKey: Deno.env.get('OPENAI_API_KEY')
    })

    console.log('Analyzing caption:', caption)

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: caption }
      ],
      temperature: 0.1,
      max_tokens: 500
    })

    const result = completion.choices[0].message.content
    console.log('AI analysis result:', result)

    // Parse the result and ensure it matches our expected format
    let parsedResult
    try {
      parsedResult = JSON.parse(result)
    } catch (error) {
      console.error('Error parsing AI response:', error)
      throw new Error('Invalid AI response format')
    }

    // Validate the structure
    if (!parsedResult?.analyzed_content?.product_info) {
      console.error('Invalid response structure:', parsedResult)
      throw new Error('Invalid response structure')
    }

    return new Response(
      JSON.stringify(parsedResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in analyze-caption:', error)
    
    return new Response(
      JSON.stringify({
        error: error.message,
        analyzed_content: {
          product_info: {
            product_name: null,
            product_code: null,
            vendor_uid: null,
            purchase_date: null,
            quantity: null,
            notes: null
          }
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})