export const getMimeTypeFromFileName = (fileName: string): string => {
  const extension = fileName.toLowerCase().split('.').pop() || '';
  const mimeTypes: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'mp4': 'video/mp4',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo',
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  };

  return mimeTypes[extension] || 'application/octet-stream';
};

export const sanitizeFileName = (fileName: string): string => {
  // Remove non-ASCII characters and spaces
  const sanitized = fileName
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/\s+/g, '_');
  
  // Extract extension
  const parts = sanitized.split('.');
  const ext = parts.pop() || '';
  const name = parts.join('.');
  
  // Generate timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  // Return sanitized name with timestamp
  return `${name}_${timestamp}.${ext}`;
};

export const validateMimeType = (mimeType: string): boolean => {
  const validMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  return validMimeTypes.includes(mimeType);
};