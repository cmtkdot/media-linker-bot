import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { generateSafeFileName, getMimeType } from './media-validators.ts';

export const uploadMediaToStorage = async (
  supabase: any,
  buffer: ArrayBuffer,
  fileUniqueId: string,
  fileType: string,
  mimeType?: string
): Promise<{ publicUrl: string }> => {
  console.log('Starting media upload to storage:', {
    fileUniqueId,
    fileType,
    mimeType
  });

  try {
    const fileName = generateSafeFileName(fileUniqueId, fileType);
    const contentType = mimeType || getMimeType(fileName);

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

    console.log('Uploading file to storage:', {
      fileName,
      contentType,
      bufferSize: buffer.byteLength
    });

    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(fileName, buffer, {
        contentType,
        upsert: true,
        cacheControl: '3600'
      });

    if (uploadError) {
      console.error('Error uploading media to storage:', uploadError);
      throw uploadError;
    }

    console.log('File uploaded successfully:', fileName);

    const { data: { publicUrl } } = await supabase.storage
      .from('media')
      .getPublicUrl(fileName);

    if (!publicUrl) {
      throw new Error('Failed to get public URL after upload');
    }

    console.log('Generated public URL:', publicUrl);
    return { publicUrl };
  } catch (error) {
    console.error('Error in uploadMediaToStorage:', error);
    throw error;
  }
};

export const validateMediaStorage = async (
  supabase: any,
  fileName: string
): Promise<boolean> => {
  try {
    const { data, error } = await supabase.storage
      .from('media')
      .list('', {
        search: fileName
      });

    if (error) {
      console.error('Error validating media storage:', error);
      return false;
    }

    return data && data.length > 0;
  } catch (error) {
    console.error('Error in validateMediaStorage:', error);
    return false;
  }
};