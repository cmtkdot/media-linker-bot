import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
          'image/jpeg', 'image/png', 'image/webp',
          'video/mp4', 'video/quicktime', 'video/webm'
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
  mimeType: string
) => {
  console.log('Uploading file:', fileName);
  
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('media')
    .upload(fileName, buffer, {
      contentType: mimeType,
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