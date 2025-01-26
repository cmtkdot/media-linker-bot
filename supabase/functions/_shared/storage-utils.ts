import { supabase } from "@/integrations/supabase/client";
import { MediaItem } from "@/types/media";

export const generateSafeFileName = (fileUniqueId: string, fileType: string): string => {
  // Remove non-ASCII characters and special characters
  const safeId = fileUniqueId.replace(/[^\x00-\x7F]/g, '').replace(/[^a-zA-Z0-9]/g, '_');
  
  // Determine file extension based on type
  const extension = fileType === 'photo' ? 'jpg' 
    : fileType === 'video' ? 'mp4'
    : fileType === 'document' ? 'pdf'
    : 'bin';

  return `${safeId}.${extension}`;
};

export const uploadToStorage = async (
  buffer: ArrayBuffer,
  fileUniqueId: string,
  fileType: string,
  mimeType: string
): Promise<string> => {
  const fileName = generateSafeFileName(fileUniqueId, fileType);
  
  try {
    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(fileName, buffer, {
        contentType: mimeType,
        upsert: true,
        cacheControl: '3600'
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = await supabase.storage
      .from('media')
      .getPublicUrl(fileName);

    return publicUrl;
  } catch (error) {
    console.error('Error uploading to storage:', error);
    throw error;
  }
};