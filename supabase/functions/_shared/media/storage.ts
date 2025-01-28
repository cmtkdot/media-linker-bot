import { SupabaseClient } from "@supabase/supabase-js";
import { StorageResult } from "./types";
import { generateFileName, getMimeType, delay } from "./utils";

export async function uploadMediaToStorage(
  supabase: SupabaseClient,
  buffer: ArrayBuffer,
  fileUniqueId: string,
  fileType: string,
  options: MediaProcessingOptions = {}
): Promise<StorageResult> {
  const { botToken, fileId, retryCount = 0 } = options;
  const fileName = generateFileName(fileUniqueId, fileType);
  const contentType = getMimeType(fileType);

  console.log("Starting media upload to storage:", {
    fileUniqueId,
    fileType,
    retryCount,
  });

  // Check if file already exists
  const { data: existingFile } = await supabase.storage
    .from("media")
    .list("", { search: fileName });

  if (existingFile && existingFile.length > 0) {
    const { data: { publicUrl } } = await supabase.storage
      .from("media")
      .getPublicUrl(fileName);

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
    } catch (error) {
      console.error("Existing file verification failed:", error);
    }
  }

  // For photos, use Telegram's file directly
  let uploadBuffer = buffer;
  if (fileType === "photo" && botToken && fileId) {
    uploadBuffer = await getTelegramFile(botToken, fileId);
  }

  // Upload file
  const { error: uploadError } = await supabase.storage
    .from("media")
    .upload(fileName, uploadBuffer, {
      contentType,
      upsert: true,
      cacheControl: "3600",
    });

  if (uploadError) {
    if (retryCount < MAX_RETRIES) {
      await delay(RETRY_DELAY * Math.pow(2, retryCount));
      return uploadMediaToStorage(
        supabase,
        uploadBuffer,
        fileUniqueId,
        fileType,
        { ...options, retryCount: retryCount + 1 }
      );
    }
    throw uploadError;
  }

  const { data: { publicUrl } } = await supabase.storage
    .from("media")
    .getPublicUrl(fileName);

  // Verify upload
  try {
    const response = await fetch(publicUrl, { method: "HEAD" });
    if (!response.ok) {
      throw new Error(`Upload verification failed: ${response.status}`);
    }
  } catch (error) {
    console.error("Upload verification failed:", error);
    throw error;
  }

  return {
    publicUrl,
    storagePath: fileName,
    isExisting: false,
  };
}

async function getTelegramFile(botToken: string, fileId: string): Promise<ArrayBuffer> {
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

  return await fileResponse.arrayBuffer();
}