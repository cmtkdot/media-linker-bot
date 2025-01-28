import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { QueueItem, ProcessingResult } from "../types/queue.types.ts";
import { uploadMediaToStorage, generateStoragePath, getMimeType } from "./storage.service.ts";
import { getAndDownloadTelegramFile } from "./telegram.service.ts";
import { validateMediaFile } from "../utils/media-validator.ts";

export async function processMediaItem(
  supabase: any,
  item: QueueItem,
  botToken: string
): Promise<ProcessingResult> {
  try {
    console.log(`Processing media item for message ${item.message_media_data.message.message_id}`);

    const mediaData = item.message_media_data.media;
    const messageData = item.message_media_data.message;
    const analysisData = item.message_media_data.analysis;
    const telegramData = item.message_media_data.telegram_data;
    
    // Validate media file
    await validateMediaFile(mediaData, mediaData.file_type);
    
    // Download and upload file
    const { buffer } = await getAndDownloadTelegramFile(mediaData.file_id, botToken);
    const storagePath = generateStoragePath(mediaData.file_unique_id, mediaData.file_type);
    const mimeType = getMimeType(mediaData.file_type);

    const uploadResult = await uploadMediaToStorage(
      supabase,
      buffer,
      mediaData.file_unique_id,
      mediaData.file_type
    );

    if (!uploadResult.success) {
      throw new Error(uploadResult.error || 'Failed to upload media');
    }

    // Create telegram_media record with complete data
    const { data: newMedia, error: insertError } = await supabase
      .from('telegram_media')
      .insert([{
        file_id: mediaData.file_id,
        file_unique_id: mediaData.file_unique_id,
        file_type: mediaData.file_type,
        public_url: uploadResult.publicUrl,
        storage_path: uploadResult.storagePath,
        message_media_data: {
          ...item.message_media_data,
          media: {
            ...mediaData,
            public_url: uploadResult.publicUrl,
            storage_path: uploadResult.storagePath,
            mime_type: mimeType
          }
        },
        telegram_data: telegramData || {},
        analyzed_content: analysisData?.analyzed_content || {},
        caption: messageData?.caption,
        message_url: messageData?.url,
        is_original_caption: item.message_media_data.meta?.is_original_caption,
        original_message_id: item.message_media_data.meta?.original_message_id,
        sender_info: item.message_media_data.sender?.sender_info || {},
        correlation_id: item.correlation_id,
        processed: true,
        message_id: item.id
      }])
      .select()
      .single();

    if (insertError) throw insertError;

    // Update queue status
    await supabase
      .from('unified_processing_queue')
      .update({
        status: 'processed',
        processed_at: new Date().toISOString()
      })
      .eq('id', item.id);

    return { success: true, mediaId: newMedia.id };
  } catch (error) {
    console.error('Error processing media item:', error);
    
    await supabase
      .from('unified_processing_queue')
      .update({
        status: 'error',
        error_message: error.message,
        processed_at: new Date().toISOString()
      })
      .eq('id', item.id);

    return { 
      success: false, 
      error: `Failed to process media: ${error.message}`
    };
  }
}