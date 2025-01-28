import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Configuration, OpenAIApi } from 'https://esm.sh/openai@4.28.0';

interface AnalyzedContent {
  product_info: {
    product_name: string | null;
    product_code: string | null;
    vendor_uid: string | null;
    purchase_date: string | null;
    quantity: number | null;
    notes: string | null;
  };
}

function analyzeWithRegex(input: string): AnalyzedContent {
  const analyzed_content: AnalyzedContent = {
    product_info: {
      product_name: null,
      product_code: null,
      vendor_uid: null,
      purchase_date: null,
      quantity: null,
      notes: null
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

async function analyzeWithAI(input: string): Promise<AnalyzedContent | null> {
  try {
    const configuration = new Configuration({
      apiKey: Deno.env.get('OPENAI_API_KEY'),
    });
    const openai = new OpenAIApi(configuration);

    const prompt = `Analyze this cannabis product information and extract structured data:
    "${input}"
    
    Format the response as JSON with these fields:
    - product_name: The product name (before # or x)
    - product_code: The full code after # (if present)
    - vendor_uid: Letters after # (if present)
    - purchase_date: Date in YYYY-MM-DD format (if present)
    - quantity: Number after x (if present)
    - notes: Any text in parentheses (if present)`;

    const response = await openai.createChatCompletion({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a precise data extraction assistant. Extract product information and return it in the exact format requested."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    });

    const result = response.data.choices[0]?.message?.content;
    if (!result) return null;

    const parsed = JSON.parse(result);
    return {
      product_info: {
        product_name: parsed.product_name || null,
        product_code: parsed.product_code || null,
        vendor_uid: parsed.vendor_uid || null,
        purchase_date: parsed.purchase_date || null,
        quantity: parsed.quantity || null,
        notes: parsed.notes || null
      }
    };
  } catch (error) {
    console.error('Error in AI analysis:', error);
    return null;
  }
}

export async function analyzeCaptionWithAI(
  caption: string,
  supabaseClient?: any
): Promise<any> {
  try {
    console.log('Analyzing caption:', caption);
    
    // Run both analyses in parallel
    const [aiResult, regexResult] = await Promise.all([
      analyzeWithAI(caption),
      Promise.resolve(analyzeWithRegex(caption))
    ]);

    // Merge results, preferring AI results when available
    const finalResult = {
      analyzed_content: {
        product_info: {
          ...regexResult.product_info,
          ...(aiResult?.product_info || {})
        },
        analysis_method: aiResult ? 'ai_with_regex_fallback' : 'regex_only',
        analysis_timestamp: new Date().toISOString()
      }
    };

    console.log('Caption analysis result:', finalResult);
    return finalResult;
  } catch (error) {
    console.error('Error in caption analysis:', error);
    throw error;
  }
}