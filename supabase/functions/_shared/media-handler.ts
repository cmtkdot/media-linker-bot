import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  TelegramAnimation,
  TelegramDocument,
  TelegramPhoto,
  TelegramVideo,
} from "./telegram-types.ts";

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

interface StorageResult {
  publicUrl: string;
  storagePath: string;
  isExisting: boolean;
}

const mimeTypes: { [key: string]: string } = {
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

export function generateFileName(
  fileUniqueId: string,
  fileType: string
): string {
  // Remove special characters, keeping only alphanumeric
  const safeId = fileUniqueId.replace(/[^a-zA-Z0-9]/g, "_");

  // Determine file extension based on type
  const extension =
    fileType === "photo"
      ? "jpg"
      : fileType === "video"
      ? "mp4"
      : fileType === "document"
      ? "pdf"
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

export async function validateMediaFile(
  mediaFile: Record<string, any>,
  mediaType: string
): Promise<void> {
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
}

type TelegramMediaFile =
  | TelegramPhoto
  | TelegramVideo
  | TelegramDocument
  | TelegramAnimation;

export async function uploadMediaToStorage(
  supabase: SupabaseClient,
  buffer: ArrayBuffer,
  fileUniqueId: string,
  fileType: string,
  botToken?: string,
  fileId?: string,
  mediaFile?: TelegramMediaFile,
  retryCount = 0
): Promise<StorageResult> {
  console.log("Starting media upload to storage:", {
    fileUniqueId,
    fileType,
    dimensions:
      mediaFile && "width" in mediaFile
        ? {
            width: mediaFile.width,
            height: mediaFile.height,
          }
        : undefined,
    retryCount,
  });

  try {
    const fileName = generateFileName(fileUniqueId, fileType);
    const contentType = getMimeType(fileType);

    // Check if file already exists
    const { data: existingFile } = await supabase.storage
      .from("media")
      .list("", {
        search: fileName,
      });

    if (existingFile && existingFile.length > 0) {
      console.log("File already exists in storage:", fileName);
      const {
        data: { publicUrl },
      } = await supabase.storage.from("media").getPublicUrl(fileName);

      // Verify the public URL is accessible
      try {
        const response = await fetch(publicUrl, { method: "HEAD" });
        if (response.ok) {
          console.log("Existing file verified:", publicUrl);
          return {
            publicUrl,
            storagePath: fileName,
            isExisting: true,
          };
        }
        throw new Error(`Existing file not accessible: ${response.status}`);
      } catch (error) {
        console.error("Existing file verification failed:", error);
        // Continue with upload if verification fails
      }
    }

    // For photos, use the provided file_id directly since Telegram already gives us the best quality
    let uploadBuffer = buffer;
    if (fileType === "photo" && botToken && fileId) {
      console.log("Getting photo from Telegram:", {
        file_id: fileId,
        file_unique_id: fileUniqueId,
        dimensions: {
          width: mediaFile?.width,
          height: mediaFile?.height,
        },
      });

      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
      );

      if (!response.ok) {
        throw new Error(`Failed to get file info: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.ok || !data.result.file_path) {
        throw new Error("Failed to get file path from Telegram");
      }

      const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${data.result.file_path}`;
      const fileResponse = await fetch(downloadUrl);

      if (!fileResponse.ok) {
        throw new Error(`Failed to download file: ${fileResponse.statusText}`);
      }

      uploadBuffer = await fileResponse.arrayBuffer();
    }

    console.log("Uploading new file to storage:", {
      fileName,
      contentType,
      bufferSize: uploadBuffer.byteLength,
    });

    const { error: uploadError } = await supabase.storage
      .from("media")
      .upload(fileName, uploadBuffer, {
        contentType,
        upsert: true,
        cacheControl: "3600",
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      if (retryCount < MAX_RETRIES) {
        console.log(`Retrying upload (${retryCount + 1}/${MAX_RETRIES})...`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
        return uploadMediaToStorage(
          supabase,
          uploadBuffer,
          fileUniqueId,
          fileType,
          botToken,
          fileId,
          mediaFile,
          retryCount + 1
        );
      }
      throw uploadError;
    }

    // Get public URL from storage path
    const {
      data: { publicUrl },
    } = await supabase.storage.from("media").getPublicUrl(fileName);

    if (!publicUrl) {
      throw new Error("Failed to get public URL after upload");
    }

    // Verify the upload using HEAD request
    try {
      const response = await fetch(publicUrl, { method: "HEAD" });
      if (!response.ok) {
        throw new Error(`Upload verification failed: ${response.status}`);
      }
      console.log("Upload verified:", {
        fileName,
        publicUrl,
        verificationStatus: response.status,
        contentLength: response.headers.get("content-length"),
        contentType: response.headers.get("content-type"),
      });
    } catch (error) {
      console.error("Upload verification failed:", error);
      throw new Error(`Upload verification failed: ${error.message}`);
    }

    // Let the database trigger handle URL consistency
    return {
      publicUrl,
      storagePath: fileName,
      isExisting: false,
    };
  } catch (error) {
    console.error("Error in uploadMediaToStorage:", error);
    throw error;
  }
}

export async function logMediaProcessing(
  supabase: SupabaseClient,
  {
    messageId,
    fileId,
    fileType,
    storagePath,
    correlationId,
    status = "processed",
    error = null,
  }: {
    messageId: string;
    fileId: string;
    fileType: string;
    storagePath: string;
    correlationId: string;
    status?: string;
    error?: string | null;
  }
) {
  try {
    await supabase.from("media_processing_logs").insert({
      message_id: messageId,
      file_id: fileId,
      file_type: fileType,
      status,
      storage_path: storagePath,
      correlation_id: correlationId,
      error_message: error,
      processed_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to log media processing:", error);
    // Non-blocking - we don't throw here as logging failure shouldn't stop processing
  }
}

export async function updateMediaRecords(
  supabase: SupabaseClient,
  {
    messageId,
    publicUrl,
    storagePath,
    messageMediaData,
  }: {
    messageId: string;
    publicUrl: string;
    storagePath: string;
    messageMediaData: Record<string, any>;
  }
) {
  const { error } = await supabase.rpc("update_media_records", {
    p_message_id: messageId,
    p_public_url: publicUrl,
    p_storage_path: storagePath,
    p_message_media_data: messageMediaData,
  });

  if (error) {
    throw error;
  }
}
