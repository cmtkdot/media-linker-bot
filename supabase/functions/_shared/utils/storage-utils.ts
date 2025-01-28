export function generateSafeFileName(fileUniqueId: string, fileType: string): string {
  // Remove non-ASCII characters and special characters
  const safeId = fileUniqueId.replace(/[^\x00-\x7F]/g, '').replace(/[^a-zA-Z0-9]/g, '_');
  
  // Determine file extension based on type
  const extension = fileType === 'photo' ? 'jpg' 
    : fileType === 'video' ? 'mp4'
    : fileType === 'document' ? 'pdf'
    : 'bin';

  return `${safeId}.${extension}`;
}

export function getMimeType(fileType: string): string {
  return fileType === 'photo' ? 'image/jpeg'
    : fileType === 'video' ? 'video/mp4'
    : fileType === 'document' ? 'application/pdf'
    : 'application/octet-stream';
}