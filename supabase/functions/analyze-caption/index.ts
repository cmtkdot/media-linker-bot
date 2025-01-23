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

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration is missing');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { caption, messageId, mediaGroupId, telegramData } = await req.json();
    
    console.log('Analyzing data:', { messageId, mediaGroupId, caption });

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
            content: `You are a JSON extraction assistant. Extract product information from captions. The MOST IMPORTANT field is product_name which should be everything before the # symbol if present, or the first line of text. Other fields are optional but try to extract them if present:

            Required field:
            - product_name: Everything before the # symbol, trimmed. If no # symbol, use the first line or full text.

            Optional fields (only include if confident):
            - product_code: Text between # and x, excluding parentheses
            - quantity: Number after "x" and before parentheses
            - vendor_uid: Letters before numbers in product code
            - purchase_date: Convert 6 digits from code (mmDDyy) to YYYY-MM-DD if present
            - notes: Text in parentheses () combined with spaces

            Return ONLY a JSON object with these fields (no markdown).
            If you can only extract product_name, that's fine - return just that field.

            Example input: "Cherry Runtz #FISH011625 x 3 (20 behind) (fresh batch)"
            Example output: {"product_name":"Cherry Runtz","product_code":"FISH011625","quantity":3,"vendor_uid":"FISH","purchase_date":"2025-01-16","notes":"20 behind fresh batch"}`
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
      const errorData = await response.text();
      console.error('Error details:', errorData);
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.choices?.[0]?.message?.content) {
      throw new Error('Invalid response from OpenAI');
    }

    try {
      // Remove any markdown formatting if present and parse JSON
      const cleanContent = data.choices[0].message.content.replace(/```json\n|\n```|```/g, '');
      let result = JSON.parse(cleanContent);

      // Ensure we at least have a product name
      if (!result.product_name && caption) {
        console.log('Fallback: Extracting product name from caption');
        // Fallback: Use text before # or first line as product name
        const productName = caption.split('#')[0].trim() || caption.split('\n')[0].trim() || caption.trim();
        result = { product_name: productName, ...result };
      }

      // Normalize and validate the result
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

      console.log('Normalized result:', normalizedResult);

      // First, update the media_groups table if this is part of a group
      if (mediaGroupId) {
        console.log('Updating media group:', mediaGroupId);
        const { error: mediaGroupError } = await supabase
          .from('media_groups')
          .upsert({
            media_group_id: mediaGroupId,
            caption: caption,
            analyzed_content: normalizedResult.analyzed_content,
            product_name: normalizedResult.product_name,
            product_code: normalizedResult.product_code,
            quantity: normalizedResult.quantity,
            vendor_uid: normalizedResult.vendor_uid,
            purchase_date: normalizedResult.purchase_date,
            notes: normalizedResult.notes,
            sync_status: 'completed'
          });

        if (mediaGroupError) {
          console.error('Error updating media_groups:', mediaGroupError);
          throw mediaGroupError;
        }
      }

      // Update individual telegram_media record if messageId is provided
      if (messageId) {
        console.log('Updating telegram_media for message:', messageId);
        const { error: updateError } = await supabase
          .from('telegram_media')
          .update({
            caption: caption,
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

      // Update all related media in the group
      if (mediaGroupId) {
        console.log('Updating all media in group:', mediaGroupId);
        const { error: groupUpdateError } = await supabase
          .from('telegram_media')
          .update({
            caption: caption,
            analyzed_content: normalizedResult.analyzed_content,
            product_name: normalizedResult.product_name,
            product_code: normalizedResult.product_code,
            quantity: normalizedResult.quantity,
            vendor_uid: normalizedResult.vendor_uid,
            purchase_date: normalizedResult.purchase_date,
            notes: normalizedResult.notes
          })
          .eq('telegram_data->>media_group_id', mediaGroupId);

        if (groupUpdateError) {
          console.error('Error updating media group:', groupUpdateError);
          throw groupUpdateError;
        }
      }

      return new Response(
        JSON.stringify(normalizedResult),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError);
      console.error('Raw response content:', data.choices[0].message.content);
      
      // Fallback: Extract at least the product name
      const productName = caption.split('#')[0].trim() || caption.split('\n')[0].trim() || caption.trim();
      const fallbackResult = {
        product_name: productName,
        analyzed_content: {
          raw_text: caption,
          extracted_data: { product_name: productName },
          confidence: 0.5,
          timestamp: new Date().toISOString(),
          model_version: 'gpt-4o-mini',
          fallback: true
        }
      };
      
      console.log('Using fallback result:', fallbackResult);
      return new Response(
        JSON.stringify(fallbackResult),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error in analyze-caption function:', error);
    // Even in case of error, try to extract at least the product name
    try {
      const { caption } = await req.json();
      if (caption) {
        const productName = caption.split('#')[0].trim() || caption.split('\n')[0].trim() || caption.trim();
        const errorFallbackResult = {
          product_name: productName,
          analyzed_content: {
            raw_text: caption,
            extracted_data: { product_name: productName },
            confidence: 0.3,
            timestamp: new Date().toISOString(),
            model_version: 'gpt-4o-mini',
            error: true,
            fallback: true
          }
        };
        return new Response(
          JSON.stringify(errorFallbackResult),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (fallbackError) {
      console.error('Error in fallback product name extraction:', fallbackError);
    }
    
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