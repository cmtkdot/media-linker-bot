export const generateSafeFileName = (fileUniqueId: string, fileType: string): string => {
  // Remove non-ASCII characters and special characters
  const safeId = fileUniqueId.replace(/[^\x00-\x7F]/g, '').replace(/[^a-zA-Z0-9]/g, '_');
  
  // Determine file extension based on type
  const extension = fileType === 'photo' ? 'jpg' 
    : fileType === 'video' ? 'mp4'
    : fileType === 'document' ? 'pdf'
    : 'bin';

  return `${safeId}.${extension}`;
};

export const validateMediaFile = async (
  mediaFile: Record<string, any>,
  mediaType: string
): Promise<void> => {
  if (!mediaFile?.file_id) {
    throw new Error("Invalid media file: missing file_id");
  }

  // Validate file size if available
  if (mediaFile.file_size && mediaFile.file_size > 100 * 1024 * 1024) {
    // 100MB limit
    throw new Error("File size exceeds maximum allowed (100MB)");
  }

  // Validate media type specific requirements
  switch (mediaType) {
    case "photo":
      if (!mediaFile.width || !mediaFile.height) {
        throw new Error("Invalid photo: missing dimensions");
      }
      break;
    case "video":
      if (!mediaFile.duration) {
        throw new Error("Invalid video: missing duration");
      }
      break;
    case "document":
      // Documents are more permissive, just ensure file_id exists
      break;
    case "animation":
      if (!mediaFile.duration) {
        throw new Error("Invalid animation: missing duration");
      }
      break;
    default:
      throw new Error(`Unsupported media type: ${mediaType}`);
  }
};

export const getMimeType = (fileType: string): string => {
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
};