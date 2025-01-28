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

    // Check for existing media
    const { data: existingMedia } = await supabase
      .from('telegram_media')
      .select('*')
      .eq('file_unique_id', item.message_media_data.media.file_unique_id)
      .maybeSingle();

    // Generate storage path using file_unique_id
    const storagePath = item.message_media_data.media.file_unique_id + 
      (item.message_media_data.media.file_type === 'photo' ? '.jpg' : 
       item.message_media_data.media.file_type === 'video' ? '.mp4' : '.bin');

    // If media exists, update metadata if needed
    if (existingMedia) {
      const needsUpdate = 
        existingMedia.telegram_data !== item.message_media_data.telegram_data ||
        existingMedia.analyzed_content !== item.message_media_data.analysis?.analyzed_content ||
        existingMedia.caption !== item.message_media_data.message?.caption;

      if (needsUpdate) {
        const { error: updateError } = await supabase
          .from('telegram_media')
          .update({
            telegram_data: item.message_media_data.telegram_data,
            analyzed_content: item.message_media_data.analysis?.analyzed_content,
            caption: item.message_media_data.message?.caption,
            message_media_data: item.message_media_data,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingMedia.id);

        if (updateError) throw updateError;
      }

      return { success: true, mediaId: existingMedia.id };
    }

    // Validate and process new media
    await validateMediaFile(item.message_media_data.media, item.message_media_data.media.file_type);
    
    const { buffer } = await getAndDownloadTelegramFile(
      item.message_media_data.media.file_id,
      botToken
    );

    const { publicUrl } = await uploadMediaToStorage(
      supabase,
      buffer,
      item.message_media_data.media.file_unique_id,
      storagePath
    );

    // Create media record with complete data
    const { data: newMedia, error: insertError } = await supabase
      .from('telegram_media')
      .insert([{
        file_id: item.message_media_data.media.file_id,
        file_unique_id: item.message_media_data.media.file_unique_id,
        file_type: item.message_media_data.media.file_type,
        public_url: publicUrl,
        storage_path: storagePath,
        message_media_data: {
          ...item.message_media_data,
          media: {
            ...item.message_media_data.media,
            public_url: publicUrl,
            storage_path: storagePath
          }
        },
        telegram_data: item.message_media_data.telegram_data,
        analyzed_content: item.message_media_data.analysis?.analyzed_content,
        caption: item.message_media_data.message?.caption,
        message_url: item.message_media_data.message?.url,
        is_original_caption: item.message_media_data.meta?.is_original_caption,
        original_message_id: item.message_media_data.meta?.original_message_id,
        message_id: item.message_id
      }])
      .select()
      .single();

    if (insertError) throw insertError;

    return { success: true, mediaId: newMedia.id };
  } catch (error) {
    console.error('Error processing media item:', error);
    return { 
      success: false, 
      error: `Failed to process media: ${error.message}`
    };
  }
}