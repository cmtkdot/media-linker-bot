import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { generateSafeFileName, getMimeType } from './media-validators.ts';

interface StorageOptions {
  maxSize?: number;
  compress?: boolean;
}

export const uploadMediaToStorage = async (
  supabase: any,
  buffer: ArrayBuffer,
  fileUniqueId: string,
  fileType: string,
  options: StorageOptions = {}
): Promise<{ publicUrl: string; storagePath: string }> => {
  try {
    // Generate safe filename with proper extension
    const fileName = generateSafeFileName(fileUniqueId, fileType);
    const contentType = getMimeType(fileName);
    
    // Validate file size
    if (options.maxSize && buffer.byteLength > options.maxSize) {
      throw new Error(`File size exceeds maximum allowed (${options.maxSize} bytes)`);
    }

    console.log('Uploading file to storage:', {
      file_name: fileName,
      content_type: contentType,
      size: buffer.byteLength
    });

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(fileName, buffer, {
        contentType,
        upsert: true,
        cacheControl: '3600'
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: { publicUrl } } = await supabase.storage
      .from('media')
      .getPublicUrl(fileName);

    console.log('File uploaded successfully:', {
      file_name: fileName,
      public_url: publicUrl
    });

    return { 
      publicUrl,
      storagePath: fileName
    };
  } catch (error) {
    console.error('Error uploading media to storage:', error);
    throw error;
  }
};

export const deleteMediaFromStorage = async (
  supabase: any,
  storagePath: string
): Promise<void> => {
  try {
    const { error } = await supabase.storage
      .from('media')
      .remove([storagePath]);

    if (error) throw error;

    console.log('File deleted from storage:', storagePath);
  } catch (error) {
    console.error('Error deleting media from storage:', error);
    throw error;
  }
};