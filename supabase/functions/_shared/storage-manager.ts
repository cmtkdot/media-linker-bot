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
  
  // Get proper MIME type based on file extension or default
  let mimeType = getMimeType(fileName, defaultMimeType);
  
  // Handle Telegram media files that come without proper MIME type
  if (mimeType === 'application/octet-stream') {
    if (fileName.includes('photo_')) {
      mimeType = 'image/jpeg';  // Default for Telegram photos
    } else if (fileName.match(/\.(jpg|jpeg|png|webp|gif|bmp)$/i)) {
      // Use extension-based MIME type for known image formats
      const ext = fileName.toLowerCase().split('.').pop();
      const mimeMap: { [key: string]: string } = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'webp': 'image/webp',
        'gif': 'image/gif',
        'bmp': 'image/bmp'
      };
      mimeType = mimeMap[ext!] || 'image/jpeg';
    }
  }
  
  console.log('Using MIME type for upload:', mimeType);

  try {
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('media')
      .upload(fileName, buffer, {
        contentType: mimeType,
        upsert: false,
        cacheControl: '3600'
      });

    if (uploadError) {
      console.error('Upload error:', { error: uploadError, mimeType, fileName });
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
    console.error('Storage upload error:', { error, mimeType, fileName });
    throw error;
  }
};

export const getPublicUrl = (supabase: any, filePath: string) => {
  const { data } = supabase.storage
    .from('media')
    .getPublicUrl(filePath);
  
  return data.publicUrl;
};