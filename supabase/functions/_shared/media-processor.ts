import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { analyzeCaptionWithAI } from "./caption-analyzer.ts";
import { withDatabaseRetry } from "./database-retry.ts";
import { uploadMediaToStorage } from "./storage-manager.ts";
import { getAndDownloadTelegramFile } from "./telegram-service.ts";
import { validateMediaFile } from "./media-validators.ts";

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

    // Validate media file
    await validateMediaFile({ file_id: fileId }, fileType);

    // Download file from Telegram
    const { buffer, filePath } = await getAndDownloadTelegramFile(fileId, botToken);

    // Upload to Supabase Storage
    const { publicUrl } = await uploadMediaToStorage(supabase, buffer, fileUniqueId, fileType);

    console.log('Successfully processed media file:', {
      file_id: fileId,
      public_url: publicUrl
    });

    return { publicUrl, storagePath: filePath };

  } catch (error) {
    console.error('Error processing media file:', error);
    
    // Log error
    await withDatabaseRetry(() => supabase
      .from('media_processing_logs')
      .insert({
        message_id: messageId,
        file_id: fileId,
        file_type: fileType,
        error_message: error.message,
        correlation_id: correlationId,
        status: 'error'
      }));

    throw error;
  }
}