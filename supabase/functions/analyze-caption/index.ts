import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      console.error('Missing OPENAI_API_KEY');
      throw new Error('OpenAI API key is not configured');
    }

    const { caption, mediaGroupId, messageId, telegramMediaId } = await req.json();
    
    if (!caption) {
      console.log('No caption provided, returning null result');
      return new Response(
        JSON.stringify(null),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Analyzing caption:', caption);

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
            3. quantity: Number after "x" (if present), ignore anything in () which should be added to notes
            4. vendor_uid: Letters before numbers in the code
            5. purchase_date: Convert 6 digits from code (mmDDyy) to YYYY-MM-DD
            6. notes: Any text in parentheses or text that is not part of the product name, product code, purchase date, vendor uid, or quantity

            Return a JSON object with:
            - product_name: string or null
            - product_code: string or null
            - quantity: number or null 
            - vendor_uid: string or null
            - purchase_date: string or null (in YYYY-MM-DD format)
            - notes: string or null 
            - raw_caption: the original caption
            - analyzed_at: current timestamp in ISO format
            - confidence_score: number between 0 and 1 indicating how confident you are in the analysis`
          },
          {
            role: 'user',
            content: caption
          }
        ],
        temperature: 0.1
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('OpenAI API response:', data);
    
    if (!data.choices?.[0]?.message?.content) {
      console.error('Invalid response from OpenAI:', data);
      throw new Error('Invalid response from OpenAI');
    }

    let result;
    try {
      result = JSON.parse(data.choices[0].message.content);
      console.log('Parsed result:', result);
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError);
      throw new Error('Failed to parse OpenAI response');
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in analyze-caption function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});