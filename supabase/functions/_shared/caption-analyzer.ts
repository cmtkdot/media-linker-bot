import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function analyzeCaptionWithAI(caption: string, supabaseUrl: string, supabaseKey: string) {
  if (!caption?.trim()) {
    console.log('No caption to analyze');
    return null;
  }

  console.log('Analyzing caption:', caption);
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase.functions.invoke('analyze-caption', {
      body: { 
        caption,
        // Don't pass IDs when just analyzing
        isAnalysisOnly: true
      },
    });

    if (error) {
      console.error('Error invoking analyze-caption function:', error);
      throw error;
    }
    
    console.log('Caption analysis result:', data);
    return data || null;
  } catch (error) {
    console.error('Error analyzing caption:', error);
    return null;
  }
}