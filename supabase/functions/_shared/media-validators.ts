const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export const validateMediaFile = async (file: any, mediaType: string) => {
  if (!file) throw new Error('No file provided');
  
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds maximum allowed size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
  }

  const allowedTypes = mediaType === 'video' ? ALLOWED_VIDEO_TYPES : ALLOWED_IMAGE_TYPES;
  if (!allowedTypes.includes(file.type)) {
    throw new Error(`File type ${file.type} is not allowed. Allowed types: ${allowedTypes.join(', ')}`);
  }
}

export const getMediaType = (message: any): string => {
  if (!message) throw new Error('No message provided');
  if (message.photo) return 'photo';
  if (message.video) return 'video';
  if (message.document) return 'document';
  if (message.animation) return 'animation';
  return 'unknown';
};