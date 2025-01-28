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

// Helper function to get highest quality photo
async function getHighestQualityPhoto(fileId: string, botToken: string): Promise<ArrayBuffer> {
  console.log('Getting file info for:', fileId);
  
  // Get file info from Telegram
  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
  );

  if (!response.ok) {
    throw new Error(`Failed to get file info: ${response.statusText}`);
  }

  const data = await response.json();
  
  if (!data.ok || !data.result.file_path) {
    throw new Error('Failed to get file path from Telegram');
  }

  // Download the actual file
  const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${data.result.file_path}`;
  console.log('Downloading from:', downloadUrl);
  
  const fileResponse = await fetch(downloadUrl);
  if (!fileResponse.ok) {
    throw new Error(`Failed to download file: ${fileResponse.statusText}`);
  }

  return await fileResponse.arrayBuffer();
}

export async function uploadMediaToStorage(
  supabase: any,
  buffer: ArrayBuffer,
  fileUniqueId: string,
  fileType: string,
  botToken?: string,
  fileId?: string,
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

    // For photos, get the highest quality version from Telegram
    let uploadBuffer = buffer;
    if (fileType === "photo" && botToken && fileId) {
      console.log("Getting highest quality photo from Telegram");
      uploadBuffer = await getHighestQualityPhoto(fileId, botToken);
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