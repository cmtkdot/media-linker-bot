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

export function validateMessageMediaData(messageMediaData: Record<string, any>): void {
  if (!messageMediaData) {
    throw new Error("Missing message_media_data");
  }

  // Check for required media data
  if (!messageMediaData.media || !messageMediaData.media.file_id) {
    throw new Error("Cannot mark as processed: missing media data");
  }

  // Validate media type specific requirements
  validateMediaFile(messageMediaData.media, messageMediaData.media.file_type);

  // Ensure we have basic message info
  if (!messageMediaData.message || !messageMediaData.message.message_id) {
    throw new Error("Missing required message information");
  }

  // Validate meta information
  if (!messageMediaData.meta) {
    throw new Error("Missing meta information");
  }
}

export function validateMediaProcessing(
  message: Record<string, any>,
  isMediaGroup: boolean
): void {
  // First validate the message media data
  validateMessageMediaData(message.message_media_data);

  // For media groups, ensure all messages are present
  if (isMediaGroup) {
    if (!message.media_group_id) {
      throw new Error("Media group ID missing for group message");
    }

    if (!message.media_group_size || message.media_group_size < 1) {
      throw new Error("Invalid media group size");
    }

    // Additional media group validation can be added here
  } else {
    // For single messages, ensure we have storage information
    const mediaData = message.message_media_data.media;
    if (!mediaData.storage_path) {
      throw new Error("Missing storage path for processed media");
    }

    if (!mediaData.public_url) {
      throw new Error("Missing public URL for processed media");
    }
  }
}