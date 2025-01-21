export const getMimeType = (fileName: string, defaultType: string = 'application/octet-stream'): string => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  
  const mimeTypes: { [key: string]: string } = {
    // Images
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'bmp': 'image/bmp',
    'heic': 'image/heic',
    'heif': 'image/heif',
    'tiff': 'image/tiff',
    'tif': 'image/tiff',
    
    // Videos
    'mp4': 'video/mp4',
    'mov': 'video/quicktime',
    'webm': 'video/webm',
    'avi': 'video/x-msvideo',
    'mkv': 'video/x-matroska',
    '3gp': 'video/3gpp',
    'wmv': 'video/x-ms-wmv',
    'ogv': 'video/ogg'
  };

  return extension ? mimeTypes[extension] || defaultType : defaultType;
};

export const validateMediaFile = async (mediaFile: any, mediaType: string) => {
  if (!mediaFile) {
    throw new Error('No media file provided');
  }

  if (!mediaFile.file_id || !mediaFile.file_unique_id) {
    throw new Error('Invalid media file: missing required fields');
  }

  // Size validation (100MB limit)
  const maxSize = 100 * 1024 * 1024; // 100MB in bytes
  if (mediaFile.file_size && mediaFile.file_size > maxSize) {
    throw new Error(`File size exceeds limit of ${maxSize} bytes`);
  }

  // Type-specific validation
  switch (mediaType) {
    case 'photo':
      if (!mediaFile.width || !mediaFile.height) {
        throw new Error('Invalid photo: missing dimensions');
      }
      break;
    case 'video':
      if (!mediaFile.duration) {
        throw new Error('Invalid video: missing duration');
      }
      break;
    case 'document':
      if (!mediaFile.file_name) {
        throw new Error('Invalid document: missing filename');
      }
      break;
    case 'animation':
      if (!mediaFile.duration || !mediaFile.width || !mediaFile.height) {
        throw new Error('Invalid animation: missing required properties');
      }
      break;
    default:
      throw new Error(`Unsupported media type: ${mediaType}`);
  }

  return true;
};

export const getMediaType = (message: any): string | null => {
  if (message.photo && message.photo.length > 0) return 'photo';
  if (message.video) return 'video';
  if (message.document) return 'document';
  if (message.animation) return 'animation';
  return null;
};