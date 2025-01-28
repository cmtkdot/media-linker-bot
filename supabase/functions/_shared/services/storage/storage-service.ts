import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function uploadMediaToStorage(
  supabase: any,
  buffer: ArrayBuffer,
  mediaData: {
    file_unique_id: string;
    file_type: string;
    file_id: string;
  }
): Promise<{ publicUrl: string; storagePath: string }> {
  try {
    // Generate storage path
    const storagePath = `${mediaData.file_unique_id}${
      mediaData.file_type === 'photo' ? '.jpg' :
      mediaData.file_type === 'video' ? '.mp4' :
      mediaData.file_type === 'document' ? '.pdf' :
      '.bin'
    }`;

    console.log('Uploading file to storage:', {
      file_unique_id: mediaData.file_unique_id,
      storage_path: storagePath,
      size: buffer.byteLength,
      file_type: mediaData.file_type
    });

    // Upload to storage with proper content type
    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(storagePath, buffer, {
        contentType: mediaData.file_type === 'photo' ? 'image/jpeg' :
                    mediaData.file_type === 'video' ? 'video/mp4' :
                    mediaData.file_type === 'document' ? 'application/pdf' :
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
      file_unique_id: mediaData.file_unique_id,
      public_url: publicUrl,
      storage_path: storagePath
    });

    return { publicUrl, storagePath };
  } catch (error) {
    console.error('Error uploading media to storage:', error);
    throw error;
  }
}