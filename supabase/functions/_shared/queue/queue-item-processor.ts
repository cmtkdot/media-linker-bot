import { QueueItem, ProcessingResult } from "./types.ts";
import { validateMediaFile } from "../media-validators.ts";
import { uploadMediaToStorage } from "../storage-manager.ts";
import { getAndDownloadTelegramFile } from "../telegram-service.ts";

export async function processQueueItem(
  supabase: any, 
  item: QueueItem, 
  originalItem?: QueueItem
): Promise<ProcessingResult> {
  console.log(`Processing queue item for message ${item.message_media_data.message.message_id}`);

  try {
    const fileId = item.message_media_data.media.file_id;
    const fileUniqueId = item.message_media_data.media.file_unique_id;
    const fileType = item.message_media_data.media.file_type;

    const { data: existingMedia } = await supabase
      .from('telegram_media')
      .select('*')
      .eq('file_unique_id', fileUniqueId)
      .maybeSingle();

    if (existingMedia) {
      console.log(`Media ${fileUniqueId} already exists, updating analyzed content`);
      
      const { error: updateError } = await supabase
        .from('telegram_media')
        .update({
          analyzed_content: item.message_media_data.analysis.analyzed_content,
          original_message_id: originalItem?.id,
          is_original_caption: item.message_media_data.meta.is_original_caption,
          message_media_data: item.message_media_data
        })
        .eq('id', existingMedia.id);

      if (updateError) throw updateError;
      return { success: true, mediaId: existingMedia.id };
    }

    await validateMediaFile(item.message_media_data.media, fileType);
    
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!botToken) throw new Error('Bot token not configured');

    const { buffer, filePath } = await getAndDownloadTelegramFile(fileId, botToken);
    const fileExt = filePath.split('.').pop() || '';
    
    const { publicUrl, storagePath } = await uploadMediaToStorage(
      supabase,
      buffer,
      fileUniqueId,
      fileExt
    );

    const mediaData = {
      file_id: fileId,
      file_unique_id: fileUniqueId,
      file_type: fileType,
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
      is_original_caption: item.message_media_data.meta.is_original_caption,
      original_message_id: originalItem?.id,
      analyzed_content: item.message_media_data.analysis.analyzed_content
    };

    const { data: newMedia, error: insertError } = await supabase
      .from('telegram_media')
      .insert([mediaData])
      .select()
      .single();

    if (insertError) throw insertError;

    await supabase
      .from('unified_processing_queue')
      .update({
        status: 'processed',
        processed_at: new Date().toISOString()
      })
      .eq('id', item.id);

    console.log(`Successfully processed media item ${fileUniqueId}`);
    return { success: true, mediaId: newMedia.id };

  } catch (error) {
    console.error(`Error processing queue item:`, error);
    
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
      error: `Failed to process queue item: ${error.message}` 
    };
  }
}