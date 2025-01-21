import { ensureStorageBucket } from './storage-utils.ts';
import { getMimeType } from './media-validators.ts';

export const uploadMediaToStorage = async (
  supabase: any,
  buffer: ArrayBuffer,
  fileUniqueId: string,
  fileExt: string,
  defaultMimeType: string = 'application/octet-stream'
) => {
  const fileName = `${fileUniqueId}.${fileExt}`;
  console.log('Uploading file:', fileName);
  
  // For Telegram photos, always use image/jpeg
  const finalMimeType = defaultMimeType === 'image/jpeg' 
    ? defaultMimeType 
    : getMimeType(fileName, defaultMimeType);

  console.log('Using MIME type:', finalMimeType);

  try {
    // Ensure storage bucket exists before upload
    await ensureStorageBucket(supabase);

    // Check if file already exists
    const { data: existingFile } = await supabase.storage
      .from('media')
      .list('', {
        search: fileName
      });

    if (existingFile && existingFile.length > 0) {
      console.log('File already exists in storage:', fileName);
      const { data: { publicUrl } } = await supabase.storage
        .from('media')
        .getPublicUrl(fileName);
      return { publicUrl };
    }

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('media')
      .upload(fileName, buffer, {
        contentType: finalMimeType,
        upsert: false,
        cacheControl: '3600'
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw uploadError;
    }

    const { data: { publicUrl } } = await supabase.storage
      .from('media')
      .getPublicUrl(fileName);

    console.log('Successfully uploaded file:', {
      fileName,
      publicUrl
    });

    return { publicUrl };
  } catch (error) {
    console.error('Error uploading media:', error);
    throw error;
  }
};