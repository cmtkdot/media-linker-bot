import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { MediaFile, MediaProcessingResult } from '../types/media.types.ts';

export const generateStoragePath = (fileUniqueId: string, fileType: string): string => {
  return `${fileUniqueId}${
    fileType === 'photo' ? '.jpg' :
    fileType === 'video' ? '.mp4' :
    fileType === 'document' ? '.pdf' :
    '.bin'
  }`;
};

export const getMimeType = (fileType: string): string => {
  return fileType === 'photo' ? 'image/jpeg' :
         fileType === 'video' ? 'video/mp4' :
         fileType === 'document' ? 'application/pdf' :
         'application/octet-stream';
};

export const uploadMediaToStorage = async (
  supabase: any,
  buffer: ArrayBuffer,
  fileUniqueId: string,
  fileType: string
): Promise<MediaProcessingResult> => {
  try {
    const storagePath = generateStoragePath(fileUniqueId, fileType);
    const mimeType = getMimeType(fileType);

    console.log('Uploading file to storage:', {
      file_unique_id: fileUniqueId,
      storage_path: storagePath,
      size: buffer.byteLength,
      file_type: fileType,
      mime_type: mimeType
    });

    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: true,
        cacheControl: '3600'
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = await supabase.storage
      .from('media')
      .getPublicUrl(storagePath);

    return { 
      success: true, 
      publicUrl, 
      storagePath 
    };
  } catch (error) {
    console.error('Error uploading media to storage:', error);
    return {
      success: false,
      error: error.message
    };
  }
};