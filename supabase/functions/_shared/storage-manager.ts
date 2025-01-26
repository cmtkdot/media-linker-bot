import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const uploadMediaToStorage = async (
  supabase: any,
  buffer: ArrayBuffer,
  fileUniqueId: string,
  fileExt: string,
  mimeType?: string
): Promise<{ publicUrl: string }> => {
  try {
    console.log('Uploading file to storage:', {
      file_unique_id: fileUniqueId,
      file_ext: fileExt,
      mime_type: mimeType
    });

    const fileName = `${fileUniqueId}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(fileName, buffer, {
        contentType: mimeType || 'application/octet-stream',
        upsert: true,
        cacheControl: '3600'
      });

    if (uploadError) {
      console.error('Error uploading to storage:', uploadError);
      throw uploadError;
    }

    const { data: { publicUrl } } = await supabase.storage
      .from('media')
      .getPublicUrl(fileName);

    if (!publicUrl) {
      throw new Error('Failed to get public URL after upload');
    }

    console.log('Successfully uploaded file:', {
      file_name: fileName,
      public_url: publicUrl
    });

    return { publicUrl };
  } catch (error) {
    console.error('Error in uploadMediaToStorage:', error);
    throw error;
  }
};