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

    if (existingMedia) {
      console.log(`Media ${item.message_media_data.media.file_unique_id} already exists`);
      return { success: true, mediaId: existingMedia.id };
    }

    // Validate and process new media
    await validateMediaFile(item.message_media_data.media, item.message_media_data.media.file_type);
    
    const { buffer, filePath } = await getAndDownloadTelegramFile(
      item.message_media_data.media.file_id,
      botToken
    );

    const fileExt = filePath.split('.').pop() || '';
    const { publicUrl, storagePath } = await uploadMediaToStorage(
      supabase,
      buffer,
      item.message_media_data.media.file_unique_id,
      fileExt
    );

    // Create media record
    const { data: newMedia, error: insertError } = await supabase
      .from('telegram_media')
      .insert([{
        file_id: item.message_media_data.media.file_id,
        file_unique_id: item.message_media_data.media.file_unique_id,
        file_type: item.message_media_data.media.file_type,
        public_url: publicUrl,
        storage_path: storagePath,
        message_media_data: item.message_media_data,
        analyzed_content: item.message_media_data.analysis.analyzed_content,
        caption: item.message_media_data.message.caption,
        message_url: item.message_media_data.message.url
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