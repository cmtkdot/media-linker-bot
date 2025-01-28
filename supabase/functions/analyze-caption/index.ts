import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

function analyzeWithRegex(input: string) {
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

  const hashtagRegex = /#([A-Za-z]+)(\d{5,6})/;
  const quantityRegex = /x\s*(\d+)/;
  const notesRegex = /\((.*?)\)/g;
  
  const hashIndex = input.indexOf('#');
  if (hashIndex > -1) {
    analyzed_content.product_info.product_name = input.substring(0, hashIndex).trim();
  } else {
    analyzed_content.product_info.product_name = input.split('x')[0].trim();
  }

  const hashMatch = hashtagRegex.exec(input);
  if (hashMatch) {
    analyzed_content.product_info.product_code = hashMatch[0].substring(1);
    analyzed_content.product_info.vendor_uid = hashMatch[1];
    
    const dateStr = hashMatch[2];
    if (dateStr.length === 5) {
      const month = dateStr.substring(0, 1).padStart(2, '0');
      const day = dateStr.substring(1, 3);
      analyzed_content.product_info.purchase_date = `2024-${month}-${day}`;
    } else if (dateStr.length === 6) {
      const month = dateStr.substring(0, 2);
      const day = dateStr.substring(2, 4);
      analyzed_content.product_info.purchase_date = `2024-${month}-${day}`;
    }
  }

  const quantityMatch = quantityRegex.exec(input);
  if (quantityMatch) {
    analyzed_content.product_info.quantity = parseInt(quantityMatch[1]);
  }

  const notes = [];
  let notesMatch;
  while ((notesMatch = notesRegex.exec(input)) !== null) {
    notes.push(notesMatch[1]);
  }
  if (notes.length > 0) {
    analyzed_content.product_info.notes = notes.join('; ');
  }

  return analyzed_content;
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
              
              Format as JSON:
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
    return JSON.parse(data.choices[0].message.content);
  } catch (error) {
    console.error('Error in AI analysis:', error);
    return null;
  }
}

function mergeAnalysis(aiResult: any, regexResult: any) {
  const merged = {
    product_info: {
      product_name: aiResult?.product_info?.product_name || regexResult.product_info.product_name,
      product_code: aiResult?.product_info?.product_code || regexResult.product_info.product_code,
      vendor_uid: aiResult?.product_info?.vendor_uid || regexResult.product_info.vendor_uid,
      purchase_date: aiResult?.product_info?.purchase_date || regexResult.product_info.purchase_date,
      quantity: aiResult?.product_info?.quantity || regexResult.product_info.quantity,
      notes: aiResult?.product_info?.notes || regexResult.product_info.notes
    }
  };

  return {
    analyzed_content: merged,
    analysis_source: aiResult ? 'ai+regex' : 'regex',
    timestamp: new Date().toISOString()
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { caption } = await req.json();
    
    if (!caption) {
      throw new Error('Caption is required');
    }

    console.log('Analyzing caption:', caption);

    // Run both analyses in parallel
    const [aiResult, regexResult] = await Promise.all([
      analyzeWithAI(caption),
      Promise.resolve(analyzeWithRegex(caption))
    ]);

    const finalResult = mergeAnalysis(aiResult, regexResult);

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
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});