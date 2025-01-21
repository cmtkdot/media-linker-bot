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

    const { caption, messageId, mediaGroupId, telegramData } = await req.json();
    
    console.log('Analyzing data:', { messageId, mediaGroupId, caption });

    const isAnalysisOnly = !messageId && !mediaGroupId;
    
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
            2. product_code: Text between # and x, excluding any parentheses content
            3. quantity: ONLY the number after "x" and before any parentheses
               - Example: "x 3 (20 behind)" should extract just 3
               - Ignore any numbers inside parentheses
            4. vendor_uid: Letters before numbers in the product code
            5. purchase_date: Convert 6 digits from code (mmDDyy) to YYYY-MM-DD
            6. notes: Any text in parentheses () should be captured as notes
               - Multiple parentheses should be combined with spaces

            Return a JSON object with:
            - product_name: string or null
            - product_code: string or null
            - quantity: number or null (ONLY the main quantity, not numbers in notes)
            - vendor_uid: string or null
            - purchase_date: string or null (in YYYY-MM-DD format)
            - notes: string or null (text from ALL parentheses)
            - raw_caption: the original caption
            - analyzed_at: current timestamp in ISO format`
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
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.choices?.[0]?.message?.content) {
      throw new Error('Invalid response from OpenAI');
    }

    const result = JSON.parse(data.choices[0].message.content);
    console.log('Parsed result:', result);

    if (isAnalysisOnly) {
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (messageId) {
      const { error: updateError } = await supabase
        .from('telegram_media')
        .update({
          analyzed_content: result,
          product_name: result.product_name,
          product_code: result.product_code,
          quantity: result.quantity,
          vendor_uid: result.vendor_uid,
          purchase_date: result.purchase_date,
          notes: result.notes
        })
        .eq('id', messageId);

      if (updateError) throw updateError;
    }

    if (mediaGroupId) {
      const { error: groupUpdateError } = await supabase
        .from('telegram_media')
        .update({
          analyzed_content: result,
          product_name: result.product_name,
          product_code: result.product_code,
          quantity: result.quantity,
          vendor_uid: result.vendor_uid,
          purchase_date: result.purchase_date,
          notes: result.notes
        })
        .eq('telegram_data->>media_group_id', mediaGroupId);

      if (groupUpdateError) throw groupUpdateError;
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