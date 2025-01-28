import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const uploadMediaToStorage = async (
  supabase: any,
  buffer: ArrayBuffer,
  fileUniqueId: string,
  fileType: string
): Promise<{ publicUrl: string; storagePath: string }> => {
  try {
    // Generate storage path
    const storagePath = `${fileUniqueId}${
      fileType === 'photo' ? '.jpg' :
      fileType === 'video' ? '.mp4' :
      '.bin'
    }`;

    console.log('Uploading file to storage:', {
      file_unique_id: fileUniqueId,
      storage_path: storagePath,
      size: buffer.byteLength,
      file_type: fileType
    });

    // Upload to storage with proper content type
    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(storagePath, buffer, {
        contentType: fileType === 'photo' ? 'image/jpeg' :
                    fileType === 'video' ? 'video/mp4' :
                    'application/octet-stream',
        upsert: true,
        cacheControl: '3600'
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw uploadError;
    }

    // Get public URL
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