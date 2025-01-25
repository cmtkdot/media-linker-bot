import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const KNOWN_VENDOR_UIDS = [
  'WOO', 'CARL', 'ENC', 'DNY', 'HEFF', 'EST', 'CUS', 'HIP', 'BNC', 'QB', 'KV', 
  'FISH', 'Q', 'BRAV', 'P', 'JWD', 'BO', 'LOTO', 'OM', 'CMTK', 'MRW', 'FT', 
  'CHAD', 'SHR', 'CBN', 'SPOB', 'PEPE', 'TURK', 'M', 'PBA', 'DBRO', 'Z', 'CHO', 
  'RB', 'KPEE', 'DINO', 'KC', 'PRM', 'ANT', 'KNG', 'TOM', 'FAKE', 'FAKEVEN', 
  'ERN', 'COO', 'BCH', 'JM', 'WITE', 'ANDY', 'BRC', 'BCHO'
];

const systemPrompt = `You are an intelligent JSON extraction assistant for product information from Telegram captions. Your goal is to extract meaningful product details while being adaptable to different caption formats.

Core Fields to Extract:

product_name:
- Primary product identifier, typically at the start of the caption
- Usually before any codes or technical details
- Should capture the main product description

product_code:
- Look for alphanumeric codes, often after # symbols
- May contain strain names or product identifiers
- Common pattern: letters followed by numbers

vendor_uid:
- Extract from product codes when present
- Should match known vendors: ${KNOWN_VENDOR_UIDS.join(', ')}
- Usually the letters before numbers in codes

quantity:
- Look for numerical quantities
- Common patterns: "x" followed by numbers
- Convert to integer when found

purchase_date:
- Look for date patterns in codes
- Convert to YYYY-MM-DD format when confident
- Common format: 6 digits representing mmDDyy

notes:
- Additional details or context
- Often in parentheses or at the end
- Can include multiple pieces of information

Guidelines:
- Extract what you can confidently identify
- product_name is most important - this must be extracted and present
- Be flexible with formats but maintain accuracy
- Don't force extractions if unclear
- Combine related information logically
- Return clean JSON with only valid extractions`;

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
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: systemPrompt
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
        model_version: 'gpt-4'
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