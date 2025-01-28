import { TelegramMediaFile } from './types';

export function validateMediaFile(
  mediaFile: Record<string, any>,
  mediaType: string
): void {
  if (!mediaFile?.file_id) {
    throw new Error("Invalid media file: missing file_id");
  }

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
}

export function validateStorageFile(fileName: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.storage
      .from('media')
      .list('', {
        search: fileName
      });

    if (error) {
      console.error('Error validating storage file:', error);
      return false;
    }

    return data && data.length > 0;
  } catch (error) {
    console.error('Error in validateStorageFile:', error);
    return false;
  }
}