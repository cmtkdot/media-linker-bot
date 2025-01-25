import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OpenAI API key is not configured");
    }

    const { caption, messageId } = await req.json();
    console.log("Analyzing caption for message:", messageId);

    if (!caption) {
      console.log("No caption provided, returning null result");
      return new Response(JSON.stringify(null), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Extract cannabis product details with special focus on product codes.

If there is a '#' in the text, treat the substring following '#' (up to the next 'x', space, or string end) as "product_code".

Within "product_code":
1. "vendor_uid": All contiguous letters at the start (1-4 letters). If not found, set null.
2. "purchase_date" extraction rules:
 IF product_code exists, find digits after vendor_uid:
 - If 6 digits: mmDDyy -> YYYY-MM-DD
 - If 5 digits: mDDyy -> YYYY-MM-DD (add leading 0)
 Examples:
 120523 -> 2023-12-05
 31524 -> 2024-03-15
 PURCHASE DATE FALL BACK (last option if you can't find a date)
   - If exactly 6 digits (mmDDyy), format them as "xx-xx-xx". 
     Example: "120523" -> "12-05-23"
   - If exactly 5 digits (mDDyy), format them as "x-xx-xx".
     Example: "31524" -> "3-15-24"
   - If the next part isn't exactly 5 or 6 digits, set "purchase_date" to null and append those digits to the vendor_uid with a hyphen. 
     Example: "CHAD1234" -> "vendor_uid"="CHAD-1234", "purchase_date"=null
3. "quantity": The integer after 'x' (if present). represents the quantity of the product.
4. "notes": Any remaining text beyond the quantity. If no 'x' is found, set "notes" to null.

"product_name": The text before the '#' or, if no '#' is found, the entire caption.

Examples:
"Blue Dream #CHAD120523x2" -> 
{
  "product_name": "Blue Dream",
  "product_code": "CHAD120523",
  "vendor_uid": "CHAD",
  "purchase_date": "12-05-23",
  "quantity": 2,
  "notes": null
}

"OG Kush #Z31524 x 1" ->
{
  "product_name": "OG Kush",
  "product_code": "Z31524",
  "vendor_uid": "Z",
  "purchase_date": "3-15-24",
  "quantity": 1,
  "notes": null
}

"Example #CHAD123x2" (not 5 or 6 digits) ->
{
  "product_code": "CHAD123",
  "vendor_uid": "CHAD-123",
  "purchase_date": null,
  "quantity": 2

  
Key rules:
ALWAYS RETURN A PRODUCT NAME
1. If product_code exists, try to extract vendor_uid and date
2. Handle both 5 and 6 digit dates
3. vendor_uid is all letters before first number
4. If no product_code, set vendor_uid to null
5. If no date, set purchase_date to null
6. If no quantity, set quantity to null
7. If no notes, set notes to null

}`,
          },
          {
            role: "user",
            content: caption,
          },
        ],
        temperature: 0.1,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `OpenAI API error: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    const cleanContent = data.choices[0].message.content.replace(
      /```json\n|\n```|```/g,
      ""
    );
    const result = JSON.parse(cleanContent);

    // Ensure we at least have a product name
    if (!result.product_name && caption) {
      const productName =
        caption.split("#")[0].trim() ||
        caption.split("\n")[0].trim() ||
        caption.trim();
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
        model_version: "gpt-4o-mini",
      },
    };

    if (messageId) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      const { error: updateError } = await supabase
        .from("telegram_media")
        .update({
          analyzed_content: normalizedResult.analyzed_content,
          product_name: normalizedResult.product_name,
          product_code: normalizedResult.product_code,
          quantity: normalizedResult.quantity,
          vendor_uid: normalizedResult.vendor_uid,
          purchase_date: normalizedResult.purchase_date,
          notes: normalizedResult.notes,
        })
        .eq("id", messageId);

      if (updateError) {
        console.error("Error updating telegram_media:", updateError);
        throw updateError;
      }
    }

    return new Response(JSON.stringify(normalizedResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in analyze-caption function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
