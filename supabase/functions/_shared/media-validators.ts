import { TelegramMediaFile } from "./media-types.ts";

export const validateMediaFile = async (
  mediaFile: TelegramMediaFile,
  mediaType: string
): Promise<void> => {
  if (!mediaFile?.file_id) {
    throw new Error("Invalid media file: missing file_id");
  }

  if (mediaFile.file_size && mediaFile.file_size > 100 * 1024 * 1024) {
    throw new Error("File size exceeds maximum allowed (100MB)");
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