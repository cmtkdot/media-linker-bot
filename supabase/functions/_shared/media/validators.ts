import { MediaFile } from './types.ts';

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