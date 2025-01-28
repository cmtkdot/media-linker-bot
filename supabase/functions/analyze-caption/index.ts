import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import OpenAI from "https://esm.sh/openai@4.28.0";
import { corsHeaders } from "../_shared/cors.ts";

const KNOWN_VENDORS = [
  'WOO', 'CARL', 'ENC', 'DNY', 'HEFF', 'EST', 'CUS', 'HIP', 'BNC', 'QB', 
  'KV', 'FISH', 'Q', 'BRAV', 'P', 'JWD', 'BO', 'LOTO', 'OM', 'CMTK', 
  'MRW', 'FT', 'CHAD', 'SHR', 'CBN', 'SPOB', 'PEPE', 'TURK', 'M', 'PBA',
  'DBRO', 'Z', 'CHO', 'RB', 'KPEE', 'DINO', 'KC', 'PRM', 'ANT', 'KNG',
  'TOM', 'FAKE', 'FAKEVEN', 'ERN', 'COO', 'BCH', 'JM', 'WITE', 'ANDY',
  'BRC', 'BCHO'
];

function parseProductCode(text: string): { product_code: string | null; vendor_uid: string | null; purchase_date: string | null; validation_errors: string[] } {
  const errors: string[] = [];
  const codeMatch = text.match(/#([A-Z]+)(\d*)/);
  
  if (!codeMatch) {
    return { 
      product_code: null, 
      vendor_uid: null, 
      purchase_date: null,
      validation_errors: []
    };
  }

  const [fullMatch, vendorPart, datePart] = codeMatch;
  const vendor = KNOWN_VENDORS.find(v => vendorPart.startsWith(v));
  
  if (!vendor) {
    errors.push(`Unknown vendor code: ${vendorPart}`);
  }

  let purchaseDate: string | null = null;
  let formattedCode = fullMatch;

  if (datePart) {
    const dateLen = datePart.length;
    if (dateLen === 5 || dateLen === 6) {
      try {
        const month = dateLen === 5 ? `0${datePart[0]}` : datePart.substring(0, 2);
        const day = dateLen === 5 ? datePart.substring(1, 3) : datePart.substring(2, 4);
        const year = `20${datePart.slice(-2)}`;
        
        const date = new Date(`${year}-${month}-${day}`);
        if (!isNaN(date.getTime())) {
          purchaseDate = date.toISOString().split('T')[0];
        } else {
          errors.push(`Invalid date format in code: ${datePart}`);
        }
      } catch {
        errors.push(`Failed to parse date from code: ${datePart}`);
      }
    } else if (datePart.length > 0) {
      formattedCode = `${vendorPart}-${datePart}`;
      errors.push(`Invalid date length in code: ${datePart}`);
    }
  }

  return {
    product_code: formattedCode,
    vendor_uid: vendor || null,
    purchase_date: purchaseDate,
    validation_errors: errors
  };
}

function parseQuantity(text: string): number | null {
  const quantityMatch = text.match(/x\s*(\d+)/i);
  return quantityMatch ? parseInt(quantityMatch[1]) : null;
}

function parseNotes(text: string, validationErrors: string[]): string | null {
  const notes: string[] = [];
  
  // Get parenthetical content
  const noteMatches = text.matchAll(/\((.*?)\)/g);
  for (const match of noteMatches) {
    if (match[1]) notes.push(match[1].trim());
  }

  // Add validation errors as notes
  if (validationErrors.length > 0) {
    notes.push(`Validation errors: ${validationErrors.join('; ')}`);
  }

  // Get remaining text that's not part of other fields
  const remainingText = text
    .replace(/#[A-Z]+\d*\s*/g, '') // Remove product code
    .replace(/x\s*\d+/g, '') // Remove quantity
    .replace(/\(.*?\)/g, '') // Remove parenthetical content
    .trim();

  if (remainingText && !remainingText.match(/^[A-Za-z\s]+$/)) {
    notes.push(`Additional content: ${remainingText}`);
  }

  return notes.length > 0 ? notes.join('; ') : null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { caption } = await req.json();
    console.log('Analyzing caption:', caption);

    if (!caption) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No caption provided',
          analyzed_content: null
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openai = new OpenAI({
      apiKey: Deno.env.get('OPENAI_API_KEY')
    });

    const systemPrompt = `You are a product data extractor. Extract ONLY the product name from the given text.
    Exclude any product codes (starting with #), quantities (x followed by numbers), or notes (in parentheses).
    If no clear product name is found, return null.
    Example input: "Blue Dream #CHAD120523 x2 (sample)"
    Example output: "Blue Dream"`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: caption }
      ],
      temperature: 0.1,
      max_tokens: 100
    });

    const productName = completion.choices[0].message.content.trim();
    
    // Parse additional fields with validation
    const { product_code, vendor_uid, purchase_date, validation_errors } = parseProductCode(caption);
    const quantity = parseQuantity(caption);
    const notes = parseNotes(caption, validation_errors);

    const analyzedContent = {
      raw_text: caption,
      extracted_data: {
        product_name: productName === "null" ? null : productName,
        product_code,
        quantity,
        vendor_uid,
        purchase_date,
        notes
      },
      confidence: 0.9,
      timestamp: new Date().toISOString(),
      model_version: "1.0"
    };

    console.log('Analysis result:', analyzedContent);

    return new Response(
      JSON.stringify({
        success: true,
        analyzed_content: analyzedContent
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-caption:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        analyzed_content: null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});