import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface MediaProcessingParams {
  fileId: string;
  fileUniqueId: string;
  fileType: string;
  messageId: string;
  botToken: string;
  correlationId: string;
}

export async function processMediaFile(supabase: any, params: MediaProcessingParams) {
  const { fileId, fileUniqueId, fileType, messageId, botToken, correlationId } = params;

  try {
    console.log('Processing media file:', {
      file_id: fileId,
      file_type: fileType,
      message_id: messageId
    });

    // Get file path from Telegram
    const filePath = await getTelegramFilePath(fileId, botToken);
    const buffer = await downloadTelegramFile(filePath, botToken);

    // Generate storage path
    const fileExt = filePath.split('.').pop() || getDefaultExtension(fileType);
    const storagePath = `${fileUniqueId}.${fileExt}`;

    console.log('Uploading file to storage:', {
      storage_path: storagePath,
      file_type: fileType
    });

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(storagePath, buffer, {
        contentType: getMimeType(fileType),
        upsert: true,
        cacheControl: '3600'
      });

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL
    const { data: { publicUrl } } = await supabase.storage
      .from('media')
      .getPublicUrl(storagePath);

    if (!publicUrl) {
      throw new Error('Failed to get public URL after upload');
    }

    // Create telegram_media record
    const { error: mediaError } = await supabase
      .from('telegram_media')
      .insert({
        file_id: fileId,
        file_unique_id: fileUniqueId,
        file_type: fileType,
        public_url: publicUrl,
        storage_path: storagePath,
        message_id: messageId,
        correlation_id: correlationId
      });

    if (mediaError) {
      throw mediaError;
    }

    console.log('Successfully processed media file:', {
      file_id: fileId,
      public_url: publicUrl,
      storage_path: storagePath
    });

    return { publicUrl, storagePath };

  } catch (error) {
    console.error('Error processing media file:', error);
    
    // Log error
    await supabase
      .from('media_processing_logs')
      .insert({
        message_id: messageId,
        file_id: fileId,
        file_type: fileType,
        error_message: error.message,
        correlation_id: correlationId,
        status: 'error'
      });

    throw error;
  }
}

async function getTelegramFilePath(fileId: string, botToken: string): Promise<string> {
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

  return data.result.file_path;
}

async function downloadTelegramFile(filePath: string, botToken: string): Promise<ArrayBuffer> {
  const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
  const response = await fetch(downloadUrl);

  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.statusText}`);
  }

  return await response.arrayBuffer();
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

function getDefaultExtension(fileType: string): string {
  switch (fileType) {
    case 'photo':
      return 'jpg';
    case 'video':
      return 'mp4';
    case 'document':
      return 'pdf';
    default:
      return 'bin';
  }
}