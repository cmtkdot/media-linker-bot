export function generateFileName(fileUniqueId: string, fileType: string): string {
  const safeId = fileUniqueId.replace(/[^\x00-\x7F]/g, '').replace(/[^a-zA-Z0-9]/g, '_');
  
  const extension = fileType === 'photo' ? 'jpg' 
    : fileType === 'video' ? 'mp4'
    : fileType === 'document' ? 'pdf'
    : 'bin';

  return `${safeId}.${extension}`;
}

export function getMimeType(fileType: string): string {
  switch (fileType) {
    case 'photo':
      return 'image/jpeg';
    case 'video':
      return 'video/mp4';
    case 'document':
      return 'application/pdf';
    default:
      return 'application/octet-stream';
  }
}

export async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function validateMediaFile(file: any, fileType: string): boolean {
  if (!file || !file.file_id || !file.file_unique_id) {
    throw new Error('Invalid media file data');
  }

  if (!['photo', 'video', 'document'].includes(fileType)) {
    throw new Error(`Unsupported file type: ${fileType}`);
  }

  return true;
}