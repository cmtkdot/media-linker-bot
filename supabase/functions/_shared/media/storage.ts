import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { MediaFile, MediaProcessingResult } from './types.ts';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

export async function uploadMediaToStorage(
  supabase: ReturnType<typeof createClient>,
  buffer: ArrayBuffer,
  fileUniqueId: string,
  fileType: string,
  botToken: string,
  fileId: string,
  mediaFile: MediaFile
): Promise<MediaProcessingResult> {
  console.log('Starting media upload:', { fileUniqueId, fileType, mediaFile });

  const fileName = generateFileName(fileUniqueId, fileType);
  
  try {
    // First check if we already have this file_id in telegram_media
    const { data: existingMedia } = await supabase
      .from('telegram_media')
      .select('public_url, storage_path')
      .eq('file_id', fileId)
      .maybeSingle();

    if (existingMedia?.public_url && existingMedia?.storage_path) {
      console.log('Reusing existing media file:', existingMedia);
      return {
        publicUrl: existingMedia.public_url,
        storagePath: existingMedia.storage_path,
        isExisting: true
      };
    }

    // Check for existing file in storage
    const { data: existingFile } = await supabase.storage
      .from('media')
      .list('', { search: fileName });

    if (existingFile && existingFile.length > 0) {
      console.log('Found existing file:', fileName);
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

    // Get file from Telegram if we need to upload it
    const fileBuffer = await getTelegramFile(botToken, fileId);
    console.log('Retrieved file from Telegram:', { size: fileBuffer.byteLength });

    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(fileName, fileBuffer, {
        contentType: getMimeType(fileType),
        upsert: true,
        cacheControl: '3600'
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw uploadError;
    }

    const { data: { publicUrl } } = await supabase.storage
      .from('media')
      .getPublicUrl(fileName);

    console.log('Upload successful:', { publicUrl, fileName });

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
  console.log('Getting file from Telegram:', fileId);
  
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

function generateFileName(fileUniqueId: string, fileType: string): string {
  const safeId = fileUniqueId.replace(/[^\x00-\x7F]/g, '').replace(/[^a-zA-Z0-9]/g, '_');
  
  const extension = fileType === 'photo' ? 'jpg' 
    : fileType === 'video' ? 'mp4'
    : fileType === 'document' ? 'pdf'
    : 'bin';

  return `${safeId}.${extension}`;
}

function getMimeType(fileType: string): string {
  switch (fileType) {
    case 'photo':
      return 'image/jpeg';
    case 'video':
      return 'video/mp4';
    case 'document':
      return 'application/pdf';
    default:
      return 'application/octet-stream';
  }
}