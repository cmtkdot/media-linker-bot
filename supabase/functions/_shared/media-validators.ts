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
    'ogv': 'video/ogg',
    
    // Documents
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'txt': 'text/plain'
  };

  return extension ? mimeTypes[extension] || defaultType : defaultType;
};

export const validateFileType = (fileName: string, allowedTypes: string[]): boolean => {
  const mimeType = getMimeType(fileName);
  return allowedTypes.includes(mimeType);
};

export const validateFileSize = (size: number, maxSize: number = 50 * 1024 * 1024): boolean => {
  return size <= maxSize;
};