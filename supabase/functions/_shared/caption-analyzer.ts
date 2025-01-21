import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function analyzeCaptionWithAI(caption: string, supabaseUrl: string, supabaseKey: string) {
  console.log('Analyzing caption:', caption);
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase.functions.invoke('analyze-caption', {
      body: { caption },
    });

    if (error) throw error;
    
    console.log('Caption analysis result:', data);
    return data;
  } catch (error) {
    console.error('Error analyzing caption:', error);
    return null;
  }
}