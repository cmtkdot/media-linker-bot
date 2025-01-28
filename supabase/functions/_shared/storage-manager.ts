import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { generateSafeFileName, getMimeType } from './media-validators.ts';

export const uploadMediaToStorage = async (
  supabase: any,
  buffer: ArrayBuffer,
  fileUniqueId: string,
  fileExt: string,
  mimeType?: string
): Promise<{ publicUrl: string }> => {
  try {
    const fileName = generateSafeFileName(fileUniqueId, fileExt);
    const contentType = mimeType || getMimeType(fileName);

    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(fileName, buffer, {
        contentType,
        upsert: true,
        cacheControl: '3600'
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = await supabase.storage
      .from('media')
      .getPublicUrl(fileName);

    return { publicUrl };
  } catch (error) {
    console.error('Error uploading media to storage:', error);
    throw error;
  }
};