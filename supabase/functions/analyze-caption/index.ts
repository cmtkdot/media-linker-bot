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
            content: `You are a JSON extraction assistant. Extract product information from captions. The MOST IMPORTANT field is product_name which should be everything before the # symbol if present, or the first line of text. Other fields are optional but try to extract them if present:

            Required field:
            - product_name: Everything before the # symbol, trimmed. If no # symbol, use the first line or full text.

            Optional fields (only include if confident):
            - product_code: Text between # and x, excluding parentheses. this is usually cannabis strain names
            - quantity: Number after "x" and before parentheses and any spaces
            - vendor_uid: Letters before numbers in product code. Common Vendor UID are: [ "WOO\nCARL\nENC\nDNY\nHEFF\nEST\nCUS\nHIP\nBNC\nQB\nKV\nFISH\nQ\nBRAV\nP\nJWD\nBO\nLOTO\nOM\nCMTK\nMRW\nFT\nCHAD\nSHR\nCBN\nSPOB\nPEPE\nTURK\nM\nPBA\nDBRO\nZ\nCHO\nRB\nKPEE\nDINO\nKC\nPRM\nANT\nKNG\nTOM\nFAKE\nFAKEVEN\nERN\nCOO\nBCH\nJM\nWITE\nANDY\nBRC\nBCHO"]
            - purchase_date: Convert 6 digits from code (mmDDyy) to YYYY-MM-DD if present
            - notes: Text in parentheses () combined with spaces or any other text after that is not part of the extracted information

            Return ONLY a JSON object with these fields (no markdown).
            If you can only extract product_name, that's fine - return just that field.`
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