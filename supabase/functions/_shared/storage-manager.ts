import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const uploadMediaToStorage = async (
  supabase: any,
  buffer: ArrayBuffer,
  fileUniqueId: string,
  storagePath: string
): Promise<{ publicUrl: string }> => {
  try {
    console.log('Uploading file to storage:', {
      file_unique_id: fileUniqueId,
      storage_path: storagePath,
      size: buffer.byteLength
    });

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(storagePath, buffer, {
        contentType: storagePath.endsWith('.jpg') ? 'image/jpeg' :
                    storagePath.endsWith('.mp4') ? 'video/mp4' :
                    'application/octet-stream',
        upsert: true,
        cacheControl: '3600'
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: { publicUrl } } = await supabase.storage
      .from('media')
      .getPublicUrl(storagePath);

    console.log('File uploaded successfully:', {
      file_unique_id: fileUniqueId,
      public_url: publicUrl,
      storage_path: storagePath
    });

    return { publicUrl };
  } catch (error) {
    console.error('Error uploading media to storage:', error);
    throw error;
  }
};