import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function analyzeCaptionWithAI(
  caption: string,
  supabaseClient?: any
): Promise<any> {
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
    return data;
  } catch (error) {
    console.error('Error in caption analysis:', error);
    throw error;
  }
}