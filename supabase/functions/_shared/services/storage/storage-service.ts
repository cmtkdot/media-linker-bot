import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { MediaProcessingResult } from '../../types/media.types';
import { generateSafeFileName, getMimeType } from '../../utils/storage-utils';

export async function uploadMediaToStorage(
  supabase: any,
  buffer: ArrayBuffer,
  fileUniqueId: string,
  fileType: string
): Promise<MediaProcessingResult> {
  try {
    const storagePath = generateSafeFileName(fileUniqueId, fileType);
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

    console.log('File uploaded successfully:', {
      file_unique_id: fileUniqueId,
      public_url: publicUrl,
      storage_path: storagePath
    });

    return { success: true, publicUrl, storagePath };
  } catch (error) {
    console.error('Error uploading media to storage:', error);
    return { success: false, error: error.message };
  }
}