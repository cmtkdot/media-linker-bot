import { SupabaseClient } from "@supabase/supabase-js";
import { MediaProcessingLog } from "./types";
import { uploadMediaToStorage } from "./storage";

export async function processMediaMessage(
  supabase: SupabaseClient,
  message: Record<string, any>,
  botToken: string
): Promise<void> {
  const messageId = message.id;
  const correlationId = message.correlation_id;
  const mediaData = message.message_media_data?.media || {};
  
  try {
    // Upload to storage and get URLs
    const { publicUrl, storagePath, isExisting } = await uploadMediaToStorage(
      supabase,
      new ArrayBuffer(0),
      mediaData.file_unique_id,
      mediaData.file_type,
      {
        botToken,
        fileId: mediaData.file_id
      }
    );

    // Update message_media_data with storage info
    const updatedMediaData = {
      ...message.message_media_data,
      media: {
        ...mediaData,
        public_url: publicUrl,
        storage_path: storagePath
      },
      meta: {
        ...message.message_media_data?.meta,
        status: 'processed',
        processed_at: new Date().toISOString()
      }
    };

    // Update messages table
    await supabase
      .from('messages')
      .update({
        message_media_data: updatedMediaData,
        status: 'processed',
        processed_at: new Date().toISOString()
      })
      .eq('id', messageId);

    // Log processing status
    await logMediaProcessing(supabase, {
      messageId,
      fileId: mediaData.file_id,
      fileType: mediaData.file_type,
      status: isExisting ? 'duplicate' : 'processed',
      storagePath,
      correlationId
    });

  } catch (error) {
    console.error('Media processing error:', error);
    
    // Update message with error
    await supabase
      .from('messages')
      .update({
        status: 'error',
        processing_error: error.message
      })
      .eq('id', messageId);

    // Log error
    await logMediaProcessing(supabase, {
      messageId,
      fileId: mediaData.file_id,
      fileType: mediaData.file_type,
      status: 'error',
      errorMessage: error.message,
      correlationId
    });

    throw error;
  }
}

async function logMediaProcessing(
  supabase: SupabaseClient,
  log: MediaProcessingLog
): Promise<void> {
  try {
    await supabase
      .from('media_processing_logs')
      .insert({
        message_id: log.messageId,
        file_id: log.fileId,
        file_type: log.fileType,
        status: log.status,
        storage_path: log.storagePath,
        error_message: log.errorMessage,
        correlation_id: log.correlationId,
        processed_at: log.status === 'processed' ? new Date().toISOString() : null
      });
  } catch (error) {
    console.error('Failed to log media processing:', error);
  }
}