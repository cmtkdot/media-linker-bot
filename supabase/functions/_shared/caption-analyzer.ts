import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function analyzeCaptionWithAI(
  caption: string,
  supabaseUrl: string,
  supabaseKey: string
): Promise<any> {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    const { data, error } = await supabase.functions.invoke('analyze-caption', {
      body: { caption }
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error in caption analysis:', error);
    return null;
  }
}