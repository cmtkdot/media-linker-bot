import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { StorageResult, TelegramMediaFile } from "./media-types.ts";
import { generateSafeFileName, getMimeType } from "./media-utils.ts";

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

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
    dimensions: mediaFile ? {
      width: mediaFile.width,
      height: mediaFile.height,
    } : undefined,
    retryCount,
  });

  try {
    const fileName = generateSafeFileName(fileUniqueId, fileType);
    const contentType = getMimeType(fileType);

    // Check for existing file
    const { data: existingFile } = await supabase.storage
      .from("media")
      .list("", { search: fileName });

    if (existingFile && existingFile.length > 0) {
      const { data: { publicUrl } } = await supabase.storage
        .from("media")
        .getPublicUrl(fileName);

      return {
        publicUrl,
        storagePath: fileName,
        isExisting: true,
      };
    }

    // Handle Telegram file download
    let uploadBuffer = buffer;
    if (fileType === "photo" && botToken && fileId) {
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