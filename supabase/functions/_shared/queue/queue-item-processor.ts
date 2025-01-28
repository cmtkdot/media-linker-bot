import { QueueItem, ProcessingResult } from "./types.ts";
import { validateMediaFile } from "../media-validators.ts";
import { uploadMediaToStorage } from "../storage-manager.ts";
import { getAndDownloadTelegramFile } from "../telegram-service.ts";

export async function processQueueItem(
  supabase: any, 
  item: QueueItem
): Promise<ProcessingResult> {
  console.log(`Processing queue item for message ${item.message_media_data.message.message_id}`);

  try {
    const mediaData = item.message_media_data.media;
    const messageData = item.message_media_data.message;
    const analysisData = item.message_media_data.analysis;

    // Check if media already exists
    const { data: existingMedia } = await supabase
      .from('telegram_media')
      .select('*')
      .eq('file_unique_id', mediaData.file_unique_id)
      .maybeSingle();

    if (existingMedia?.public_url) {
      console.log(`Media ${mediaData.file_unique_id} already processed`);
      return { success: true, mediaId: existingMedia.id };
    }

    // Validate media file
    await validateMediaFile(mediaData, mediaData.file_type);
    
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!botToken) throw new Error('Bot token not configured');

    // Download and upload file
    const { buffer, filePath } = await getAndDownloadTelegramFile(mediaData.file_id, botToken);
    const fileExt = filePath.split('.').pop() || '';
    
    const { publicUrl, storagePath } = await uploadMediaToStorage(
      supabase,
      buffer,
      mediaData.file_unique_id,
      fileExt
    );

    // Create or update telegram_media record
    const mediaRecord = {
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
      // Extract analyzed content fields
      product_name: analysisData?.product_name,
      product_code: analysisData?.product_code,
      quantity: analysisData?.quantity,
      vendor_uid: analysisData?.vendor_uid,
      purchase_date: analysisData?.purchase_date,
      notes: analysisData?.notes,
      caption: messageData.caption,
      message_url: messageData.url,
      analyzed_content: analysisData?.analyzed_content || {},
      is_original_caption: item.message_media_data.meta?.is_original_caption,
      original_message_id: item.message_media_data.meta?.original_message_id
    };

    const { data: newMedia, error: insertError } = await supabase
      .from('telegram_media')
      .insert([mediaRecord])
      .select()
      .single();

    if (insertError) throw insertError;

    // Update queue item status
    await supabase
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

    console.log(`Successfully processed media item ${mediaData.file_unique_id}`);
    return { success: true, mediaId: newMedia.id };

  } catch (error) {
    console.error(`Error processing queue item:`, error);
    
    await supabase
      .from('unified_processing_queue')
      .update({
        status: 'error',
        error_message: error.message,
        processed_at: new Date().toISOString(),
        message_media_data: {
          ...item.message_media_data,
          meta: {
            ...item.message_media_data.meta,
            status: 'error',
            error: error.message,
            processed_at: new Date().toISOString()
          }
        }
      })
      .eq('id', item.id);

    return { 
      success: false, 
      error: `Failed to process queue item: ${error.message}` 
    };
  }
}