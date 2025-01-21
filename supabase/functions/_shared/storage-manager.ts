import { getMimeType } from './media-validators.ts';

export const ensureStorageBucket = async (supabase: any) => {
  try {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('Error listing buckets:', listError);
      throw listError;
    }

    const mediaBucket = buckets.find((b: any) => b.name === 'media');
    
    if (!mediaBucket) {
      console.log('Creating media storage bucket');
      const { error: createError } = await supabase.storage.createBucket('media', {
        public: true,
        allowedMimeTypes: [
          'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
          'image/gif', 'image/tiff', 'image/bmp', 'image/heic',
          'image/heif', 'video/mp4', 'video/quicktime', 'video/webm',
          'video/x-msvideo', 'video/x-matroska', 'video/3gpp',
          'video/x-ms-wmv', 'video/ogg'
        ],
        fileSizeLimit: 100 * 1024 * 1024 // 100MB limit
      });
      
      if (createError) throw createError;
    }
  } catch (error) {
    console.error('Error ensuring storage bucket:', error);
    throw error;
  }
};

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
  let finalMimeType = defaultMimeType;
  if (fileName.includes('photo_')) {
    finalMimeType = 'image/jpeg';
    console.log('Using image/jpeg for Telegram photo');
  } else {
    // For other files, try to determine MIME type from extension
    finalMimeType = getMimeType(fileName, defaultMimeType);
    console.log('Determined MIME type:', finalMimeType);
  }

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
      console.error('Storage upload error:', { error: uploadError, mimeType: finalMimeType, fileName });
      throw new Error(`Failed to upload file: ${uploadError.message}`);
    }

    const { data: { publicUrl }, error: urlError } = await supabase.storage
      .from('media')
      .getPublicUrl(fileName);

    if (urlError) {
      console.error('Error getting public URL:', urlError);
      throw new Error(`Failed to get public URL: ${urlError.message}`);
    }

    return { uploadData, publicUrl };
  } catch (error) {
    console.error('Storage upload error:', { error, mimeType: finalMimeType, fileName });
    throw error;
  }
};

export const deleteMediaFromStorage = async (supabase: any, filePath: string) => {
  try {
    const { error } = await supabase.storage
      .from('media')
      .remove([filePath]);

    if (error) {
      console.error('Error deleting file from storage:', error);
      throw error;
    }

    console.log('Successfully deleted file from storage:', filePath);
  } catch (error) {
    console.error('Error in deleteMediaFromStorage:', error);
    throw error;
  }
};