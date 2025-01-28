import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
): Promise<{ publicUrl: string; storagePath: string }> => {
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

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw uploadError;
    }

    const { data: { publicUrl } } = await supabase.storage
      .from('media')
      .getPublicUrl(storagePath);

    console.log('File uploaded successfully:', {
      file_unique_id: fileUniqueId,
      public_url: publicUrl,
      storage_path: storagePath
    });

    return { publicUrl, storagePath };
  } catch (error) {
    console.error('Error uploading media to storage:', error);
    throw error;
  }
};