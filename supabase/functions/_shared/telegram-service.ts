import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function getFileInfo(fileId: string, botToken: string) {
  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
  );
  const data = await response.json();
  return data.ok ? data.result : null;
}

export async function downloadTelegramFile(filePath: string, botToken: string) {
  const response = await fetch(
    `https://api.telegram.org/file/bot${botToken}/${filePath}`
  );
  return response;
}

export async function analyzeCaption(caption: string, supabaseUrl: string, supabaseKey: string) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase.functions.invoke('analyze-caption', {
      body: { caption },
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error analyzing caption:', error);
    return null;
  }
}

export function getMessageType(message: any): string {
  if (message.photo) return 'photo';
  if (message.video) return 'video';
  if (message.document) return 'document';
  if (message.animation) return 'animation';
  return 'text';
}