import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { downloadTelegramFile } from '../telegram/telegram.service';
import { uploadToStorage } from '../storage/storage.service';
import { QueueItem } from '../../types/queue.types';

export async function processMediaItem(
  supabase: any,
  item: QueueItem,
  botToken: string
): Promise<{ success: boolean; mediaId?: string; error?: string }> {
  try {
    const { message_media_data } = item;
    const fileId = message_media_data.media.file_id;
    
    // Download from Telegram
    const fileData = await downloadTelegramFile(fileId, botToken);
    
    // Upload to storage
    const { publicUrl, storagePath } = await uploadToStorage(
      supabase,
      fileData.buffer,
      message_media_data.media.file_unique_id,
      message_media_data.media.file_type
    );

    // Create telegram_media record
    const { data: mediaRecord, error } = await supabase
      .from('telegram_media')
      .insert({
        file_id: fileId,
        file_unique_id: message_media_data.media.file_unique_id,
        file_type: message_media_data.media.file_type,
        public_url: publicUrl,
        storage_path: storagePath,
        message_media_data,
        correlation_id: item.correlation_id,
        message_id: item.id
      })
      .select()
      .single();

    if (error) throw error;

    return { success: true, mediaId: mediaRecord.id };
  } catch (error) {
    console.error('Error processing media:', error);
    return { success: false, error: error.message };
  }
}