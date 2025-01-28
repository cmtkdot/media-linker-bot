import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import OpenAI from "https://esm.sh/openai@4.28.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ProductInfo {
  product_name: string | null;
  product_code: string | null;
  quantity: number | null;
  vendor_uid: string | null;
  purchase_date: string | null;
  notes: string | null;
}

interface AnalyzedContent {
  raw_text: string;
  extracted_data: ProductInfo;
  confidence: number;
  timestamp: string;
  model_version: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { caption } = await req.json()
    console.log('Analyzing caption:', caption)

    if (!caption) {
      console.log('No caption provided')
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No caption provided',
          analyzed_content: null
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const openai = new OpenAI({
      apiKey: Deno.env.get('OPENAI_API_KEY')
    })

    const systemPrompt = `You are a product data extractor. Extract structured product information from the given text.
    Always return a JSON object with these fields, using null for missing values:
    {
      "raw_text": "the original text",
      "extracted_data": {
        "product_name": string or null,
        "product_code": string or null,
        "quantity": number or null,
        "vendor_uid": string or null,
        "purchase_date": string or null (YYYY-MM-DD format),
        "notes": string or null
      },
      "confidence": number (0-1),
      "timestamp": current ISO timestamp,
      "model_version": "1.0"
    }`

    console.log('Sending request to OpenAI')
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: caption }
      ],
      temperature: 0.1,
      max_tokens: 500
    })

    const result = completion.choices[0].message.content
    console.log('Raw AI response:', result)

    let parsedResult: AnalyzedContent
    try {
      parsedResult = JSON.parse(result)
      console.log('Parsed result:', parsedResult)

      // Validate the structure
      if (!parsedResult.extracted_data || 
          typeof parsedResult.confidence !== 'number' ||
          !parsedResult.timestamp ||
          !parsedResult.model_version) {
        throw new Error('Missing required fields in AI response')
      }

      // Ensure all fields in extracted_data are present
      const requiredFields = ['product_name', 'product_code', 'quantity', 'vendor_uid', 'purchase_date', 'notes']
      for (const field of requiredFields) {
        if (!(field in parsedResult.extracted_data)) {
          throw new Error(`Missing ${field} in extracted_data`)
        }
      }

    } catch (error) {
      console.error('Error parsing or validating AI response:', error)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid AI response format',
          analyzed_content: null
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Successfully analyzed caption')
    return new Response(
      JSON.stringify({
        success: true,
        analyzed_content: parsedResult
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in analyze-caption:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        analyzed_content: null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})