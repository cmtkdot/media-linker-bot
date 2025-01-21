export const validateMediaFile = async (mediaFile: any, mediaType: string) => {
  if (!mediaFile?.file_id) {
    throw new Error('Invalid media file: missing file_id');
  }

  // Validate file size if available
  if (mediaFile.file_size && mediaFile.file_size > 100 * 1024 * 1024) { // 100MB limit
    throw new Error('File size exceeds maximum allowed (100MB)');
  }

  // Validate media type specific requirements
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
      // Documents are more permissive, just ensure file_id exists
      break;
    case 'animation':
      if (!mediaFile.duration) {
        throw new Error('Invalid animation: missing duration');
      }
      break;
    default:
      throw new Error(`Unsupported media type: ${mediaType}`);
  }
};

export const getMimeType = (filePath: string, defaultType: string = 'application/octet-stream'): string => {
  const ext = filePath.split('.').pop()?.toLowerCase();
  
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
    // Videos
    'mp4': 'video/mp4',
    'mov': 'video/quicktime',
    'webm': 'video/webm',
    'avi': 'video/x-msvideo',
    'mkv': 'video/x-matroska',
    '3gp': 'video/3gpp',
    'wmv': 'video/x-ms-wmv',
    'ogg': 'video/ogg',
    // Documents
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };

  return ext ? (mimeTypes[ext] || defaultType) : defaultType;
};