import { supabase } from "@/integrations/supabase/client";
import { MediaItem } from "@/types/media";

export const generateSafeFileName = (fileUniqueId: string, fileType: string): string => {
  // Remove non-ASCII characters and special characters
  const safeId = fileUniqueId.replace(/[^\x00-\x7F]/g, '').replace(/[^a-zA-Z0-9]/g, '_');
  
  // Determine file extension based on type
  const extension = fileType === 'photo' ? 'jpg' 
    : fileType === 'video' ? 'mp4'
    : fileType === 'document' ? 'pdf'
    : 'bin';

  return `${safeId}.${extension}`;
};

export const getMimeType = (fileType: string): string => {
  switch (fileType) {
    case 'photo':
      return 'image/jpeg';
    case 'video':
      return 'video/mp4';
    case 'document':
      return 'application/pdf';
    default:
      return 'application/octet-stream';
  }
};

export const uploadToStorage = async (
  buffer: ArrayBuffer,
  fileUniqueId: string,
  fileType: string,
  mimeType: string
): Promise<string> => {
  console.log('Starting file upload to storage:', {
    fileUniqueId,
    fileType,
    mimeType
  });

  const fileName = generateSafeFileName(fileUniqueId, fileType);
  
  try {
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
      return publicUrl;
    }

    console.log('Uploading file to storage:', fileName);

    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(fileName, buffer, {
        contentType: mimeType,
        upsert: true,
        cacheControl: '3600'
      });

    if (uploadError) {
      console.error('Error uploading to storage:', uploadError);
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
    return publicUrl;
  } catch (error) {
    console.error('Error in uploadToStorage:', error);
    throw error;
  }
};

export const validateStorageFile = async (fileName: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase.storage
      .from('media')
      .list('', {
        search: fileName
      });

    if (error) {
      console.error('Error validating storage file:', error);
      return false;
    }

    return data && data.length > 0;
  } catch (error) {
    console.error('Error in validateStorageFile:', error);
    return false;
  }
};