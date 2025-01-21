import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function analyzeCaptionWithAI(caption: string, supabaseUrl: string, supabaseKey: string) {
  if (!caption) {
    console.log('No caption to analyze');
    return null;
  }

  console.log('Analyzing caption:', caption);
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase.functions.invoke('analyze-caption', {
      body: { caption },
    });

    if (error) {
      console.error('Error invoking analyze-caption function:', error);
      throw error;
    }
    
    if (!data) {
      console.warn('No data returned from caption analysis');
      return null;
    }
    
    console.log('Caption analysis result:', data);
    return data;
  } catch (error) {
    console.error('Error analyzing caption:', error);
    // Return null instead of throwing to allow processing to continue
    return null;
  }
}