import { QueueItem } from '../../types/queue.types';
import { uploadMediaToStorage } from '../storage/storage-service';
import { downloadTelegramFile } from '../telegram/telegram-service';
import { validateMediaFile } from '../../utils/media-validator';

export async function processMediaItem(
  supabase: any,
  item: QueueItem
): Promise<{ success: boolean; mediaId?: string; error?: string }> {
  try {
    const { message_media_data } = item;
    const mediaData = message_media_data.media;
    
    // Validate media file
    await validateMediaFile(mediaData);
    
    // Get bot token from env
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!botToken) throw new Error('Bot token not configured');

    // Download from Telegram
    const fileData = await downloadTelegramFile(mediaData.file_id, botToken);
    
    // Upload to storage
    const { publicUrl, storagePath } = await uploadMediaToStorage(
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
        message_media_data: message_media_data,
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