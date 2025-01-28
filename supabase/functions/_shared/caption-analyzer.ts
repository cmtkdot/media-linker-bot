import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface AnalyzedContent {
  product_info: {
    product_name: string | null;
    product_code: string | null;
    vendor_uid: string | null;
    purchase_date: string | null;
    quantity: number | null;
    notes: string | null;
  };
}

export async function analyzeCaptionWithAI(
  caption: string,
  supabaseClient?: any
): Promise<AnalyzedContent> {
  try {
    // Use provided client or create new one
    const supabase = supabaseClient || createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );
    
    console.log('Analyzing caption:', caption);
    
    const { data, error } = await supabase.functions.invoke('analyze-caption', {
      body: { caption }
    });

    if (error) {
      console.error('Error in caption analysis:', error);
      throw error;
    }

    console.log('Caption analysis result:', data);
    
    // Ensure we return the correct structure even if the analysis fails
    if (!data?.analyzed_content?.product_info) {
      return {
        product_info: {
          product_name: null,
          product_code: null,
          vendor_uid: null,
          purchase_date: null,
          quantity: null,
          notes: null
        }
      };
    }

    return data.analyzed_content;
  } catch (error) {
    console.error('Error in caption analysis:', error);
    // Return empty structure on error
    return {
      product_info: {
        product_name: null,
        product_code: null,
        vendor_uid: null,
        purchase_date: null,
        quantity: null,
        notes: null
      }
    };
  }
}