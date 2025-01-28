import { MediaFile } from '../types/media.types';

export const validateMediaFile = async (mediaFile: MediaFile) => {
  if (!mediaFile?.file_id) {
    throw new Error('Invalid media file: missing file_id');
  }

  // Validate file size if available
  if (mediaFile.file_size && mediaFile.file_size > 100 * 1024 * 1024) {
    throw new Error('File size exceeds maximum allowed (100MB)');
  }

  // Basic validation passed
  return true;
};