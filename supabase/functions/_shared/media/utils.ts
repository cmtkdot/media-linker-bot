const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

export function getMimeType(fileType: string): string {
  switch (fileType) {
    case "photo":
      return "image/jpeg";
    case "video":
      return "video/mp4";
    case "document":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}

export function generateFileName(fileUniqueId: string, fileType: string): string {
  // Remove special characters, keeping only alphanumeric
  const safeId = fileUniqueId.replace(/[^a-zA-Z0-9]/g, "_");

  // Determine file extension based on type
  const extension = fileType === "photo" ? "jpg"
    : fileType === "video" ? "mp4"
    : fileType === "document" ? "pdf"
    : "bin";

  return `${safeId}.${extension}`;
}

export function getMediaType(message: Record<string, any>): string | null {
  if (message.photo) return "photo";
  if (message.video) return "video";
  if (message.document) return "document";
  if (message.animation) return "animation";
  return null;
}

export async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const mimeTypes: { [key: string]: string } = {
  // Images
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  // Videos
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  // Documents
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export function getFileExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() || '';
}

export function getMimeTypeFromFileName(fileName: string): string {
  const ext = getFileExtension(fileName);
  return mimeTypes[ext] || 'application/octet-stream';
}

export function validateFileSize(size: number, maxSize: number = 100 * 1024 * 1024): boolean {
  return size <= maxSize;
}

export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function generateStoragePath(fileUniqueId: string, fileType: string): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const fileName = generateFileName(fileUniqueId, fileType);
  
  return `${year}/${month}/${fileName}`;
}

export function isValidMediaType(mediaType: string): boolean {
  return ['photo', 'video', 'document', 'animation'].includes(mediaType);
}

export function getRetryDelay(retryCount: number): number {
  return Math.min(RETRY_DELAY * Math.pow(2, retryCount), 10000);
}

export function shouldRetry(error: any, retryCount: number): boolean {
  if (retryCount >= MAX_RETRIES) return false;
  
  // Don't retry client errors (4xx)
  if (error.status && error.status >= 400 && error.status < 500) return false;
  
  // Don't retry certain error types
  if (error.code === 'DUPLICATE_FILE') return false;
  if (error.code === 'INVALID_FILE_TYPE') return false;
  
  return true;
}