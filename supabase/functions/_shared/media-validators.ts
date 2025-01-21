const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/tiff',
  'image/bmp',
  'image/heic',
  'image/heif'
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
  if (!file.mime_type && file.file_path) {
    file.mime_type = getMimeType(file.file_path);
  }

  const mimeType = file.mime_type?.toLowerCase();
  const allowedTypes = mediaType === 'video' ? ALLOWED_VIDEO_TYPES : ALLOWED_IMAGE_TYPES;

  if (mimeType && !allowedTypes.includes(mimeType)) {
    console.warn(`Warning: Received mime type ${mimeType} for ${mediaType}`);
    // Don't throw error, let's try to infer from extension
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
  const ext = filePath.split('.').pop()?.toLowerCase();
  
  const mimeTypes: { [key: string]: string } = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'tiff': 'image/tiff',
    'bmp': 'image/bmp',
    'heic': 'image/heic',
    'heif': 'image/heif',
    'mp4': 'video/mp4',
    'mov': 'video/quicktime',
    'webm': 'video/webm',
    'avi': 'video/x-msvideo',
    'mkv': 'video/x-matroska',
    '3gp': 'video/3gpp',
    'wmv': 'video/x-ms-wmv',
    'ogg': 'video/ogg'
  };

  // For Telegram photos that come without extension
  if (!ext && defaultType !== 'application/octet-stream') {
    return defaultType;
  }

  return ext ? (mimeTypes[ext] || defaultType) : defaultType;
};