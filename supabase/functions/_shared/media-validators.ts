const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/tiff',
  'image/bmp',
  'image/heic',
  'image/heif',
  'application/octet-stream'  // Allow this for Telegram photos
];

const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-msvideo',
  'video/x-matroska',
  'video/3gpp',
  'video/x-ms-wmv',
  'video/ogg'
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export const validateMediaFile = async (file: any, mediaType: string) => {
  if (!file) throw new Error('No file provided');
  
  if (file.file_size && file.file_size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds maximum allowed size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
  }

  // Special handling for Telegram files without explicit MIME type
  if (!file.mime_type || file.mime_type === 'application/octet-stream') {
    // For photos, always default to JPEG
    if (mediaType === 'photo') {
      console.log('Setting default MIME type for Telegram photo to image/jpeg');
      file.mime_type = 'image/jpeg';
    }
    // For other files, try to infer from file path first
    else if (file.file_path) {
      const inferredMimeType = getMimeType(file.file_path);
      console.log('Inferred MIME type from file path:', inferredMimeType);
      file.mime_type = inferredMimeType;
    }
  }

  const mimeType = file.mime_type?.toLowerCase();
  const allowedTypes = mediaType === 'video' ? ALLOWED_VIDEO_TYPES : ALLOWED_IMAGE_TYPES;

  // Only warn about MIME type if it's not a photo (since we handle those specially)
  if (mimeType && mediaType !== 'photo' && !allowedTypes.includes(mimeType)) {
    console.warn(`Warning: Received mime type ${mimeType} for ${mediaType}`);
  }

  return true;
}

export const getMediaType = (message: any): string => {
  if (!message) throw new Error('No message provided');
  
  // Check for photo array first
  if (message.photo && Array.isArray(message.photo) && message.photo.length > 0) {
    return 'photo';
  }
  
  // Check for video
  if (message.video) {
    return 'video';
  }
  
  // Check for document with image/video mime type
  if (message.document) {
    const mimeType = message.document.mime_type?.toLowerCase();
    if (ALLOWED_IMAGE_TYPES.includes(mimeType)) {
      return 'photo';
    }
    if (ALLOWED_VIDEO_TYPES.includes(mimeType)) {
      return 'video';
    }
    return 'document';
  }
  
  // Check for animation (GIF)
  if (message.animation) {
    return 'animation';
  }
  
  return 'unknown';
};

export const getMimeType = (filePath: string, defaultType: string = 'application/octet-stream'): string => {
  // If it's a Telegram photo without extension, return image/jpeg
  if (filePath.startsWith('photos/') || filePath.includes('photo_')) {
    return 'image/jpeg';
  }

  const extension = filePath.toLowerCase().split('.').pop();
  if (!extension) return defaultType;

  const mimeTypes: { [key: string]: string } = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'bmp': 'image/bmp',
    'heic': 'image/heic',
    'heif': 'image/heif',
    'tiff': 'image/tiff',
    'mp4': 'video/mp4',
    'mov': 'video/quicktime',
    'webm': 'video/webm',
    'avi': 'video/x-msvideo',
    'mkv': 'video/x-matroska',
    '3gp': 'video/3gpp',
    'wmv': 'video/x-ms-wmv',
    'ogg': 'video/ogg'
  };

  return mimeTypes[extension] || defaultType;
};