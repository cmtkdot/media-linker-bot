import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import OpenAI from 'https://esm.sh/openai@4.28.0';

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
    const openai = new OpenAI({
      apiKey: Deno.env.get('OPENAI_API_KEY'),
    });

    const prompt = `Analyze this cannabis product information and extract structured data following these exact rules:

Input Format: Product entries follow the pattern "[Product Name] #[Vendor_UID][Date] x [Quantity] ([Notes])"

Extraction Rules:

1. Product Name:
- Extract all text before '#' or 'x' if no '#' exists
- Remove trailing/leading whitespace
- Required field

2. Product Code:
- Must start with '#'
- Includes vendor UID and purchase date
- Format: #[VENDOR_UID][DATE]
- Null if not present

3. Vendor UID:
- 1-4 uppercase letters following '#'
- Examples: CARL, FISH, SHR, Z
- Null if no product code

4. Purchase Date:
- Follows vendor UID
- Convert to format: YYYY-MM-DD
- Handle two formats:
  * 5 digits (mDDyy): First digit is month (pad with 0)
  * 6 digits (mmDDyy): First two digits are month
- Assume 2024 for year if only 2 digits
- Null if no date

5. Quantity:
- Number following 'x'
- Remove whitespace
- Convert to integer
- Null if not present

6. Notes:
- Any text within parentheses ()
- Multiple notes joined with semicolon
- Include any text that doesn't fit other fields
- Null if no extra information

Analyze this input: "${input}"

Return ONLY a JSON object with this exact structure:
{
  "product_name": string or null,
  "product_code": string or null,
  "vendor_uid": string or null,
  "purchase_date": string or null (YYYY-MM-DD format),
  "quantity": number or null,
  "notes": string or null
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a precise data extraction assistant. Extract cannabis product information and return it in the exact format requested. Always follow the date format rules exactly."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    });

    const result = response.choices[0]?.message?.content;
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