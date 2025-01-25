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

    const { caption, messageId } = await req.json();
    
    console.log('Analyzing caption for message:', messageId);

    if (!caption) {
      console.log('No caption provided, returning null result');
      return new Response(
        JSON.stringify(null),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
            content: `You are an AI assistant that extracts cannabis product information from Telegram captions. Extract the following information:

            product_name (REQUIRED):
                The cannabis strain name from the start of the caption. This must always be extracted, even if nothing else can be. It's typically everything before the # symbol, or the entire caption if no # exists.

                product_code:
                The full code after the # symbol, which contains the vendor ID and date. format is #[vendor_uid][purchase_date]

                vendor_uid:
                The letters at the start of the product code. Common vendors are: [
                  "WOO", "CARL", "ENC", "DNY", "HEFF", "EST", "CUS", "HIP", "BNC", "QB", "KV", 
                  "FISH", "Q", "BRAV", "P", "JWD", "BO", "LOTO", "OM", "CMTK", "MRW", "FT", 
                  "CHAD", "SHR", "CBN", "SPOB", "PEPE", "TURK", "M", "PBA", "DBRO", "Z", "CHO", 
                  "RB", "KPEE", "DINO", "KC", "PRM", "ANT", "KNG", "TOM", "FAKE", "FAKEVEN", 
                  "ERN", "COO", "BCH", "JM", "WITE", "ANDY", "BRC", "BCHO"
                ]

                purchase_date:
                Convert the last 6 digits from the product code from mmDDyy to YYYY-MM-DD format.

                quantity:
                The number that appears after "x" in the caption.

                notes:
                Any additional text after the quantity.

                Example inputs and outputs:

                "Blue Dream #WOO031524 x 2 (fresh batch)"
                {
                  "product_name": "Blue Dream",
                  "product_code": "WOO031524",
                  "vendor_uid": "WOO",
                  "purchase_date": "2024-03-15",
                  "quantity": 2,
                  "notes": "fresh batch"
                }

                "Wedding Cake #CHAD112923x 5 A+ grade"
                {
                  "product_name": "Wedding Cake",
                  "product_code": "CHAD112923",
                  "vendor_uid": "CHAD",
                  "purchase_date": "2023-11-29",
                  "quantity": 5,
                  "notes": "A+ grade"
                }

                "Purple Haze"
                {
                  "product_name": "Purple Haze"
                }

                Remember: product_name is required and must always be extracted. All other fields are optional and should only be included if they are clearly present in the caption.`
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
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const cleanContent = data.choices[0].message.content.replace(/```json\n|\n```|```/g, '');
    const result = JSON.parse(cleanContent);

    // Ensure we at least have a product name
    if (!result.product_name && caption) {
      const productName = caption.split('#')[0].trim() || caption.split('\n')[0].trim() || caption.trim();
      result.product_name = productName;
    }

    const normalizedResult = {
      product_name: result.product_name || null,
      product_code: result.product_code || null,
      quantity: result.quantity ? Number(result.quantity) : null,
      vendor_uid: result.vendor_uid || null,
      purchase_date: result.purchase_date || null,
      notes: result.notes || null,
      analyzed_content: {
        raw_text: caption,
        extracted_data: result,
        confidence: 1.0,
        timestamp: new Date().toISOString(),
        model_version: 'gpt-4o-mini'
      }
    };

    if (messageId) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const { error: updateError } = await supabase
        .from('telegram_media')
        .update({
          analyzed_content: normalizedResult.analyzed_content,
          product_name: normalizedResult.product_name,
          product_code: normalizedResult.product_code,
          quantity: normalizedResult.quantity,
          vendor_uid: normalizedResult.vendor_uid,
          purchase_date: normalizedResult.purchase_date,
          notes: normalizedResult.notes
        })
        .eq('id', messageId);

      if (updateError) {
        console.error('Error updating telegram_media:', updateError);
        throw updateError;
      }
    }

    return new Response(
      JSON.stringify(normalizedResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
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