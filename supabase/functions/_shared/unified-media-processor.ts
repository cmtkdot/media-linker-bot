import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { QueueItem, ProcessingResult } from './types/queue-types.ts';
import { uploadToStorage } from './services/storage/storage-service.ts';
import { downloadTelegramFile } from './services/telegram/telegram-service.ts';

export async function processMediaItem(
  supabase: any,
  item: QueueItem,
  botToken: string
): Promise<ProcessingResult> {
  try {
    console.log('Processing media item:', {
      correlation_id: item.correlation_id,
      message_id: item.message_media_data?.message?.message_id,
      file_id: item.message_media_data?.media?.file_id
    });

    const mediaData = item.message_media_data?.media;
    if (!mediaData?.file_id || !mediaData?.file_unique_id || !mediaData?.file_type) {
      throw new Error('Missing required media data fields');
    }

    // Download from Telegram
    const fileData = await downloadTelegramFile(mediaData.file_id, botToken);
    
    // Upload to storage
    const { publicUrl, storagePath } = await uploadToStorage(
      supabase,
      fileData.buffer,
      mediaData.file_unique_id,
      mediaData.file_type
    );

    // Create telegram_media record
    const { data: mediaRecord, error } = await supabase
      .from('telegram_media')
      .insert({
        file_id: mediaData.file_id,
        file_unique_id: mediaData.file_unique_id,
        file_type: mediaData.file_type,
        public_url: publicUrl,
        storage_path: storagePath,
        message_media_data: item.message_media_data,
        correlation_id: item.correlation_id,
        message_id: item.message_id,
        analyzed_content: item.message_media_data?.analysis?.analyzed_content || {},
        caption: item.message_media_data?.message?.caption,
        is_original_caption: item.message_media_data?.meta?.is_original_caption,
        original_message_id: item.message_media_data?.meta?.original_message_id
      })
      .select()
      .single();

    if (error) throw error;

    console.log('Successfully processed media item:', {
      correlation_id: item.correlation_id,
      media_id: mediaRecord.id,
      public_url: publicUrl
    });

    return { success: true, mediaId: mediaRecord.id };
  } catch (error) {
    console.error('Error processing media:', error);
    return { success: false, error: error.message };
  }
}