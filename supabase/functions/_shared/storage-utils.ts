import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function ensureStorageBucket(supabase: any) {
  try {
    // Check if bucket exists
    const { data: buckets, error: listError } = await supabase
      .storage
      .listBuckets();

    if (listError) {
      console.error('Error checking buckets:', listError);
      throw listError;
    }

    const mediaBucket = buckets.find((b: any) => b.name === 'media');
    
    if (!mediaBucket) {
      console.log('Creating media bucket...');
      const { error: createError } = await supabase
        .storage
        .createBucket('media', {
          public: true,
          fileSizeLimit: 100000000, // 100MB
          allowedMimeTypes: [
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'video/mp4',
            'video/quicktime',
            'video/webm'
          ]
        });

      if (createError) {
        console.error('Error creating bucket:', createError);
        throw createError;
      }
      console.log('Media bucket created successfully');
    } else {
      console.log('Media bucket already exists');
    }
  } catch (error) {
    console.error('Error in ensureStorageBucket:', error);
    throw error;
  }
}

export function sanitizeFileName(fileName: string): string {
  // Remove non-ASCII characters and special characters
  const sanitized = fileName
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/[^a-zA-Z0-9.-]/g, '_');
  
  // Ensure the filename isn't too long
  const MAX_LENGTH = 100;
  const extension = sanitized.split('.').pop() || '';
  const name = sanitized.slice(0, -extension.length - 1);
  
  if (name.length > MAX_LENGTH) {
    return `${name.slice(0, MAX_LENGTH)}.${extension}`;
  }
  
  return sanitized;
}

export function getMimeType(fileName: string, defaultType: string = 'application/octet-stream'): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  
  const mimeTypes: { [key: string]: string } = {
    // Images
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    // Videos
    'mp4': 'video/mp4',
    'mov': 'video/quicktime',
    'webm': 'video/webm',
    'avi': 'video/x-msvideo',
    'mkv': 'video/x-matroska'
  };

  return ext ? (mimeTypes[ext] || defaultType) : defaultType;
}