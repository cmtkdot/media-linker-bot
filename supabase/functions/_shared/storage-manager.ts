const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

interface StorageResult {
  publicUrl: string;
  storagePath: string;
  isExisting: boolean;
}

function getMimeType(fileType: string): string {
  return fileType === "photo"
    ? "image/jpeg"
    : fileType === "video"
    ? "video/mp4"
    : fileType === "document"
    ? "application/pdf"
    : "application/octet-stream";
}

function generateFileName(fileUniqueId: string, fileType: string): string {
  const safeId = fileUniqueId
    .replace(/[^\x00-\x7F]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "_");
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

export async function uploadMediaToStorage(
  supabase: any,
  buffer: ArrayBuffer,
  fileUniqueId: string,
  fileType: string,
  retryCount = 0
): Promise<StorageResult> {
  console.log("Starting media upload to storage:", {
    fileUniqueId,
    fileType,
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

    console.log("Uploading new file to storage:", {
      fileName,
      contentType,
      bufferSize: buffer.byteLength,
    });

    const { error: uploadError } = await supabase.storage
      .from("media")
      .upload(fileName, buffer, {
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
          buffer,
          fileUniqueId,
          fileType,
          retryCount + 1
        );
      }
      throw uploadError;
    }

    const {
      data: { publicUrl },
    } = await supabase.storage.from("media").getPublicUrl(fileName);

    if (!publicUrl) {
      throw new Error("Failed to get public URL after upload");
    }

    // Verify the upload
    const response = await fetch(publicUrl, { method: "HEAD" });
    if (!response.ok) {
      throw new Error(`Upload verification failed: ${response.status}`);
    }

    console.log("Upload successful:", {
      fileName,
      publicUrl,
      verificationStatus: response.status,
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
