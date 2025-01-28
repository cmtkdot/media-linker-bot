import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateMediaFile } from "./media-validators.ts";
import { uploadMediaToStorage } from "./storage-manager.ts";
import { getAndDownloadTelegramFile } from "./telegram-service.ts";

interface ProcessingError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export async function processMediaItem(
  supabase: any,
  item: any,
  botToken: string
) {
  try {
    console.log(`Processing media item ${item.id}`);

    // Check for duplicate file_id
    const { data: existingMedia } = await supabase
      .from('telegram_media')
      .select('id, file_id, storage_path')
      .eq('file_unique_id', item.message_media_data.media.file_unique_id)
      .maybeSingle();

    if (existingMedia) {
      console.log('Media already exists:', existingMedia);
      return existingMedia;
    }

    // Validate media file
    await validateMediaFile(
      item.message_media_data.media, 
      item.message_media_data.media.file_type
    );

    // Download file from Telegram
    console.log('Downloading file from Telegram:', item.message_media_data.media.file_id);
    const { buffer } = await getAndDownloadTelegramFile(
      item.message_media_data.media.file_id,
      botToken
    );

    // Upload to storage with proper options
    const options = item.message_media_data.media.file_type === 'video' 
      ? { maxSize: 50 * 1024 * 1024, compress: true }
      : undefined;

    const { publicUrl, storagePath } = await uploadMediaToStorage(
      supabase,
      buffer,
      item.message_media_data.media.file_unique_id,
      item.message_media_data.media.file_type,
      options
    );

    // Update message_media_data with storage info
    const updatedMessageMediaData = {
      ...item.message_media_data,
      media: {
        ...item.message_media_data.media,
        public_url: publicUrl,
        storage_path: storagePath
      },
      meta: {
        ...item.message_media_data.meta,
        status: 'processed',
        updated_at: new Date().toISOString()
      }
    };

    // Create telegram_media record
    const { data: mediaRecord, error: insertError } = await supabase
      .from('telegram_media')
      .insert({
        file_id: item.message_media_data.media.file_id,
        file_unique_id: item.message_media_data.media.file_unique_id,
        file_type: item.message_media_data.media.file_type,
        public_url: publicUrl,
        storage_path: storagePath,
        message_media_data: updatedMessageMediaData,
        analyzed_content: item.message_media_data.analysis.analyzed_content || {},
        telegram_data: item.message_media_data.telegram_data,
        message_url: item.message_media_data.message.url,
        caption: item.message_media_data.message.caption,
        is_original_caption: item.message_media_data.meta.is_original_caption,
        original_message_id: item.message_media_data.meta.original_message_id,
        message_id: item.id
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Update queue status
    const { error: queueError } = await supabase
      .from('unified_processing_queue')
      .update({
        status: 'completed',
        processed_at: new Date().toISOString(),
        message_media_data: updatedMessageMediaData
      })
      .eq('id', item.id);

    if (queueError) throw queueError;

    console.log('Successfully processed media item:', {
      item_id: item.id,
      media_id: mediaRecord.id,
      public_url: publicUrl,
      storage_path: storagePath
    });

    return mediaRecord;

  } catch (error) {
    const processError: ProcessingError = {
      code: error.code || 'PROCESSING_ERROR',
      message: error.message || 'Unknown error occurred',
      details: error.details || {}
    };

    console.error('Media processing error:', {
      error_code: processError.code,
      error_message: processError.message,
      item_id: item.id,
      details: processError.details
    });

    // Update queue with error
    await supabase
      .from('unified_processing_queue')
      .update({
        status: 'error',
        error_message: JSON.stringify(processError),
        processed_at: new Date().toISOString()
      })
      .eq('id', item.id);

    throw error;
  }
}