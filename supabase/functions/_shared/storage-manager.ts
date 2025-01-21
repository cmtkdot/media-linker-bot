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
          'video/x-ms-wmv', 'video/ogg', 'application/octet-stream'
        ],
        fileSizeLimit: 50 * 1024 * 1024
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
  fileName: string,
  defaultMimeType: string = 'application/octet-stream'
) => {
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

export const getPublicUrl = (supabase: any, filePath: string) => {
  const { data } = supabase.storage
    .from('media')
    .getPublicUrl(filePath);
  
  return data.publicUrl;
};