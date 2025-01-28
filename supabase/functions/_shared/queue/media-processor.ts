import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { QueueItem, ProcessingResult } from "./types.ts";
import { validateMediaFile } from "../media-validators.ts";
import { uploadMediaToStorage } from "../storage-manager.ts";
import { getAndDownloadTelegramFile } from "../telegram-service.ts";

export async function processMediaItem(
  supabase: any,
  item: QueueItem,
  botToken: string
): Promise<ProcessingResult> {
  try {
    console.log(`Processing media item for message ${item.message_media_data.message.message_id}`);

    const mediaData = item.message_media_data.media;
    
    // Check for existing media
    const { data: existingMedia } = await supabase
      .from('telegram_media')
      .select('*')
      .eq('file_unique_id', mediaData.file_unique_id)
      .maybeSingle();

    // If media exists and has a public URL, just update metadata
    if (existingMedia?.public_url) {
      console.log('Media already processed:', existingMedia);
      
      const { error: updateError } = await supabase
        .from('telegram_media')
        .update({
          telegram_data: item.message_media_data.telegram_data,
          analyzed_content: item.message_media_data.analysis?.analyzed_content,
          message_media_data: item.message_media_data,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingMedia.id);

      if (updateError) throw updateError;
      return { success: true, mediaId: existingMedia.id };
    }

    // Validate and process new media
    await validateMediaFile(mediaData, mediaData.file_type);
    
    // Download file from Telegram
    console.log('Downloading file from Telegram:', mediaData.file_id);
    const { buffer } = await getAndDownloadTelegramFile(
      mediaData.file_id,
      botToken
    );

    // Upload to storage
    console.log('Uploading to storage:', mediaData.file_unique_id);
    const { publicUrl, storagePath } = await uploadMediaToStorage(
      supabase,
      buffer,
      mediaData.file_unique_id,
      mediaData.file_type
    );

    // Create media record with complete data
    const { data: newMedia, error: insertError } = await supabase
      .from('telegram_media')
      .insert([{
        file_id: mediaData.file_id,
        file_unique_id: mediaData.file_unique_id,
        file_type: mediaData.file_type,
        public_url: publicUrl,
        storage_path: storagePath,
        message_media_data: {
          ...item.message_media_data,
          media: {
            ...mediaData,
            public_url: publicUrl,
            storage_path: storagePath
          }
        },
        telegram_data: item.message_media_data.telegram_data || {},
        analyzed_content: item.message_media_data.analysis?.analyzed_content || {},
        caption: item.message_media_data.message?.caption,
        message_url: item.message_media_data.message?.url,
        is_original_caption: item.message_media_data.meta?.is_original_caption,
        original_message_id: item.message_media_data.meta?.original_message_id,
        message_id: item.message_id,
        processed: true
      }])
      .select()
      .single();

    if (insertError) throw insertError;

    // Update queue item status
    const { error: queueError } = await supabase
      .from('unified_processing_queue')
      .update({
        status: 'processed',
        processed_at: new Date().toISOString(),
        message_media_data: {
          ...item.message_media_data,
          media: {
            ...mediaData,
            public_url: publicUrl,
            storage_path: storagePath
          },
          meta: {
            ...item.message_media_data.meta,
            status: 'processed',
            processed_at: new Date().toISOString()
          }
        }
      })
      .eq('id', item.id);

    if (queueError) throw queueError;

    console.log('Successfully processed media item:', {
      file_id: mediaData.file_id,
      public_url: publicUrl,
      media_id: newMedia.id
    });

    return { success: true, mediaId: newMedia.id };
  } catch (error) {
    console.error('Error processing media item:', error);
    return { 
      success: false, 
      error: `Failed to process media: ${error.message}`
    };
  }
}