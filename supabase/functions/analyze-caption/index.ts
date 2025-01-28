import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function analyzeProductContent(input: string) {
  const analyzed_content = {
    product_info: {
      product_name: null as string | null,
      product_code: null as string | null,
      vendor_uid: null as string | null,
      purchase_date: null as string | null,
      quantity: null as number | null,
      notes: null as string | null
    }
  };

  // Regular expressions
  const hashtagRegex = /#([A-Za-z]+)(\d{5,6})/;
  const quantityRegex = /x\s*(\d+)/;
  const notesRegex = /\((.*?)\)/g;
  
  // Extract product name (everything before #)
  const hashIndex = input.indexOf('#');
  if (hashIndex > -1) {
    analyzed_content.product_info.product_name = input.substring(0, hashIndex).trim();
  } else {
    analyzed_content.product_info.product_name = input.split('x')[0].trim();
  }

  // Extract product code and parse vendor/date
  const hashMatch = hashtagRegex.exec(input);
  if (hashMatch) {
    analyzed_content.product_info.product_code = hashMatch[0].substring(1);
    analyzed_content.product_info.vendor_uid = hashMatch[1];
    
    // Parse date
    const dateStr = hashMatch[2];
    if (dateStr.length === 5) {
      // Format: mDDyy
      const month = dateStr.substring(0, 1).padStart(2, '0');
      const day = dateStr.substring(1, 3);
      const year = dateStr.substring(3);
      analyzed_content.product_info.purchase_date = `2024-${month}-${day}`;
    } else if (dateStr.length === 6) {
      // Format: mmDDyy
      const month = dateStr.substring(0, 2);
      const day = dateStr.substring(2, 4);
      const year = dateStr.substring(4);
      analyzed_content.product_info.purchase_date = `2024-${month}-${day}`;
    }
  }

  // Extract quantity
  const quantityMatch = quantityRegex.exec(input);
  if (quantityMatch) {
    analyzed_content.product_info.quantity = parseInt(quantityMatch[1]);
  }

  // Extract notes (anything in parentheses)
  const notes = [];
  let notesMatch;
  while ((notesMatch = notesRegex.exec(input)) !== null) {
    notes.push(notesMatch[1]);
  }
  if (notes.length > 0) {
    analyzed_content.product_info.notes = notes.join('; ');
  }

  return { analyzed_content };
}

async function analyzeWithAI(caption: string) {
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openAIApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a specialized product information extractor. Given a product caption, extract:
              - Product name (before # or x)
              - Product code (starting with #)
              - Vendor UID (letters after #)
              - Purchase date (numbers after vendor UID, format YYYY-MM-DD)
              - Quantity (number after x)
              - Notes (text in parentheses)
              
              Format the response as a JSON object matching:
              {
                "product_info": {
                  "product_name": string | null,
                  "product_code": string | null,
                  "vendor_uid": string | null,
                  "purchase_date": string | null,
                  "quantity": number | null,
                  "notes": string | null
                }
              }`
          },
          {
            role: 'user',
            content: caption
          }
        ],
        temperature: 0.1,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const aiAnalysis = JSON.parse(data.choices[0].message.content);
    console.log('AI Analysis:', aiAnalysis);

    return aiAnalysis;
  } catch (error) {
    console.error('Error in AI analysis:', error);
    // Fallback to regex analysis if AI fails
    return analyzeProductContent(caption);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { caption, messageId, chatId, mediaGroupId } = await req.json();
    
    if (!caption) {
      throw new Error('Caption is required');
    }

    console.log('Analyzing caption:', {
      caption,
      messageId,
      chatId,
      mediaGroupId
    });

    // First try AI analysis
    const aiResult = await analyzeWithAI(caption);
    
    // If AI fails or returns invalid data, fallback to regex
    const regexResult = analyzeProductContent(caption);
    
    // Merge results, preferring AI results when available
    const finalResult = {
      analyzed_content: {
        product_info: {
          ...regexResult.analyzed_content.product_info,
          ...aiResult.product_info
        }
      }
    };

    console.log('Analysis result:', finalResult);

    return new Response(
      JSON.stringify({
        success: true,
        data: finalResult
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in analyze-caption:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        data: {
          analyzed_content: {} // Fallback empty analysis
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});