import { generateSafeFileName, validateMediaFile, getMimeType } from './media-validators.ts';
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

interface StorageResult {
  publicUrl: string;
  storagePath: string;
  isExisting: boolean;
}

export async function uploadMediaToStorage(
  supabase: SupabaseClient,
  buffer: ArrayBuffer,
  fileUniqueId: string,
  fileType: string,
  botToken?: string,
  fileId?: string,
  mediaFile?: Record<string, any>,
  retryCount = 0
): Promise<StorageResult> {
  console.log("Starting media upload to storage:", {
    fileUniqueId,
    fileType,
    dimensions: mediaFile && 'width' in mediaFile ? {
      width: mediaFile.width,
      height: mediaFile.height,
    } : undefined,
    retryCount,
  });

  try {
    const fileName = generateSafeFileName(fileUniqueId, fileType);
    const contentType = getMimeType(fileType);

    // Check if file already exists
    const { data: existingFile } = await supabase.storage
      .from("media")
      .list("", {
        search: fileName,
      });

    if (existingFile && existingFile.length > 0) {
      console.log("File already exists in storage:", fileName);
      const { data: { publicUrl } } = await supabase.storage
        .from("media")
        .getPublicUrl(fileName);

      return {
        publicUrl,
        storagePath: fileName,
        isExisting: true,
      };
    }

    // For photos, use the provided file_id directly
    let uploadBuffer = buffer;
    if (fileType === "photo" && botToken && fileId) {
      console.log("Getting photo from Telegram:", {
        file_id: fileId,
        file_unique_id: fileUniqueId,
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

    console.log("Uploading file to storage:", {
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

    const { data: { publicUrl } } = await supabase.storage
      .from("media")
      .getPublicUrl(fileName);

    console.log("Upload successful:", {
      fileName,
      publicUrl,
    });

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