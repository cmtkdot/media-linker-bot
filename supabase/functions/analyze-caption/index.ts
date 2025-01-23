import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key is not configured');
    }

    const { caption } = await req.json();
    
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
            content: `Extract product information from captions following these strict rules:
            1. product_name: Everything before the # symbol, trimmed
            2. product_code: Text between #and x, excluding any parentheses content
               - If vendor_uid is found, it should be part of product_code
            3. quantity: ONLY the number after "x" and before any parentheses
               - Example: "x 3 (20 behind)" should extract just 3
               - Ignore any numbers inside parentheses
            4. vendor_uid: Letters before numbers in the product code
               - Example: "FISH011625" should extract "FISH"
            5. purchase_date: Convert 6 digits from code (mmDDyy) to YYYY-MM-DD
               - Example: "011625" should become "2025-01-16"
            6. notes: Any text in parentheses () should be captured as notes
               - Multiple parentheses should be combined with spaces

            Return ONLY a valid JSON object with these exact fields.`
          },
          {
            role: 'user',
            content: caption
          }
        ],
        temperature: 0.1,
        max_tokens: 500
      }),
    });

    if (!response.ok) {
      console.error('OpenAI API error:', response.status, response.statusText);
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.choices?.[0]?.message?.content) {
      throw new Error('Invalid response from OpenAI');
    }

    try {
      const result = JSON.parse(data.choices[0].message.content.trim());
      console.log('Parsed result:', result);

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError);
      throw new Error(`Failed to parse OpenAI response: ${parseError.message}`);
    }
  } catch (error) {
    console.error('Error in analyze-caption function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});