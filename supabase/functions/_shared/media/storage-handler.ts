import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { MediaFile, MediaProcessingResult } from './types.ts';

export async function uploadMediaToStorage(
  supabase: ReturnType<typeof createClient>,
  fileBuffer: ArrayBuffer,
  mediaFile: MediaFile,
  botToken: string
): Promise<MediaProcessingResult> {
  console.log('Starting media upload:', { 
    file_id: mediaFile.file_id,
    file_type: mediaFile.file_type
  });

  try {
    // Generate safe filename
    const fileName = generateSafeFileName(mediaFile.file_unique_id, mediaFile.file_type);
    
    // Check for existing file first
    const { data: existingFile } = await supabase.storage
      .from('media')
      .list('', { search: fileName });

    if (existingFile && existingFile.length > 0) {
      console.log('Found existing file:', fileName);
      const { data: { publicUrl } } = await supabase.storage
        .from('media')
        .getPublicUrl(fileName);

      return {
        publicUrl,
        storagePath: fileName,
        isExisting: true
      };
    }

    // Get file from Telegram if we need to upload it
    const fileData = await getTelegramFile(botToken, mediaFile.file_id);
    console.log('Retrieved file from Telegram:', { size: fileData.byteLength });

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(fileName, fileData, {
        contentType: getMimeType(mediaFile.file_type),
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

function generateSafeFileName(fileUniqueId: string, fileType: string): string {
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