import { SupabaseClient } from "@supabase/supabase-js";
import { MediaProcessingResult, MediaStorageOptions } from "./types";
import { generateFileName, getMimeType, delay } from "./utils";

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

export async function uploadMediaToStorage(
  supabase: SupabaseClient,
  buffer: ArrayBuffer,
  fileUniqueId: string,
  fileType: string,
  options: MediaStorageOptions = {}
): Promise<MediaProcessingResult> {
  const { botToken, fileId, retryCount = 0 } = options;
  const fileName = generateFileName(fileUniqueId, fileType);
  
  console.log('Starting media upload:', { fileUniqueId, fileType, retryCount });

  try {
    // Check for existing file
    const { data: existingFile } = await supabase.storage
      .from('media')
      .list('', { search: fileName });

    if (existingFile && existingFile.length > 0) {
      const { data: { publicUrl } } = await supabase.storage
        .from('media')
        .getPublicUrl(fileName);

      // Verify file accessibility
      try {
        const response = await fetch(publicUrl, { method: 'HEAD' });
        if (response.ok) {
          console.log('Using existing file:', publicUrl);
          return {
            publicUrl,
            storagePath: fileName,
            isExisting: true
          };
        }
      } catch (error) {
        console.warn('Existing file verification failed:', error);
      }
    }

    // Get file from Telegram if needed
    let uploadBuffer = buffer;
    if (botToken && fileId) {
      uploadBuffer = await getTelegramFile(botToken, fileId);
    }

    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(fileName, uploadBuffer, {
        contentType: getMimeType(fileType),
        upsert: true,
        cacheControl: '3600'
      });

    if (uploadError) {
      if (retryCount < MAX_RETRIES) {
        console.log(`Retrying upload (${retryCount + 1}/${MAX_RETRIES})...`);
        await delay(RETRY_DELAY * Math.pow(2, retryCount));
        return uploadMediaToStorage(supabase, uploadBuffer, fileUniqueId, fileType, 
          { ...options, retryCount: retryCount + 1 });
      }
      throw uploadError;
    }

    const { data: { publicUrl } } = await supabase.storage
      .from('media')
      .getPublicUrl(fileName);

    return {
      publicUrl,
      storagePath: fileName,
      isExisting: false
    };
  } catch (error) {
    console.error('Storage upload error:', error);
    throw error;
  }
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
    throw new Error('Failed to get file path from Telegram');
  }

  const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${data.result.file_path}`;
  const fileResponse = await fetch(downloadUrl);

  if (!fileResponse.ok) {
    throw new Error(`Failed to download file: ${fileResponse.statusText}`);
  }

  return await fileResponse.arrayBuffer();
}