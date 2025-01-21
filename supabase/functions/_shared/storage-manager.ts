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
  const mimeType = getMimeType(fileName, defaultMimeType);
  console.log('Determined MIME type for upload:', mimeType);
  
  // For Telegram photos without extension, ensure they're treated as JPEGs
  const finalMimeType = mimeType === 'application/octet-stream' && fileName.includes('photo') 
    ? 'image/jpeg' 
    : mimeType;
  
  console.log('Final MIME type for upload:', finalMimeType);

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('media')
    .upload(fileName, buffer, {
      contentType: finalMimeType,
      upsert: false,
      cacheControl: '3600'
    });

  if (uploadError) {
    console.error('Upload error:', uploadError);
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
};

export const getPublicUrl = (supabase: any, filePath: string) => {
  const { data } = supabase.storage
    .from('media')
    .getPublicUrl(filePath);
  
  return data.publicUrl;
};