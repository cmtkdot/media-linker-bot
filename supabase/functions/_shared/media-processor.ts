import { uploadMediaToStorage } from "./storage-manager.ts";
import { MediaProcessingParams } from "./types.ts";

export async function processMediaFile(
  supabase: any,
  params: MediaProcessingParams
) {
  const {
    fileId,
    fileUniqueId,
    fileType,
    messageId,
    botToken,
    correlationId,
    caption,
    messageUrl,
    analyzedContent,
  } = params;

  console.log("Processing media file:", {
    file_id: fileId,
    file_type: fileType,
    message_id: messageId,
    correlation_id: correlationId,
  });

  try {
    // Get file from Telegram
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

    const filePath = data.result.file_path;
    
    // Download file from Telegram
    const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
    const fileResponse = await fetch(downloadUrl);

    if (!fileResponse.ok) {
      throw new Error(`Failed to download file: ${fileResponse.statusText}`);
    }

    const buffer = await fileResponse.arrayBuffer();

    console.log('File downloaded successfully, uploading to storage...');

    // Upload to Supabase Storage with verification and pass bot token for photos
    const { publicUrl, storagePath } = await uploadMediaToStorage(
      supabase,
      buffer,
      fileUniqueId,
      fileType,
      botToken,
      fileId
    );

    // Update message_media_data with new file information
    const updatedMessageMediaData = {
      media: {
        file_id: fileId,
        file_unique_id: fileUniqueId,
        file_type: fileType,
        public_url: publicUrl,
        storage_path: storagePath
      },
      meta: {
        status: 'processed',
        processed_at: new Date().toISOString()
      }
    };

    // Begin transaction to update both tables
    const { error: updateError } = await supabase.rpc('update_media_records', {
      p_message_id: messageId,
      p_public_url: publicUrl,
      p_storage_path: storagePath,
      p_message_media_data: updatedMessageMediaData
    });

    if (updateError) {
      throw updateError;
    }

    // Log successful processing
    await supabase
      .from('media_processing_logs')
      .insert({
        message_id: messageId,
        file_id: fileId,
        file_type: fileType,
        status: 'processed',
        storage_path: storagePath,
        correlation_id: correlationId,
        processed_at: new Date().toISOString()
      });

    return {
      success: true,
      publicUrl,
      storagePath,
      mediaId: messageId,
    };

  } catch (error) {
    console.error("Error processing media:", error);
    throw error;
  }
}
