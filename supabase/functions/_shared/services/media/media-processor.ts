import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { MessageMediaData } from '../../types/message-types.ts';
import { downloadTelegramFile } from '../telegram/telegram-service.ts';
import { uploadToStorage } from '../storage/storage-service.ts';

export async function processMediaItem(
  supabase: any,
  messageMediaData: MessageMediaData,
  botToken: string
): Promise<{ success: boolean; error?: string; mediaId?: string }> {
  try {
    console.log('Processing media item:', {
      correlation_id: messageMediaData.meta.correlation_id,
      message_id: messageMediaData.message.message_id,
      file_id: messageMediaData.media?.file_id
    });

    const mediaData = messageMediaData.media;
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
        message_media_data: messageMediaData,
        correlation_id: messageMediaData.meta.correlation_id,
        message_id: messageMediaData.message.message_id,
        analyzed_content: messageMediaData.analysis.analyzed_content || {},
        caption: messageMediaData.message.caption,
        is_original_caption: messageMediaData.meta.is_original_caption,
        original_message_id: messageMediaData.meta.original_message_id
      })
      .select()
      .single();

    if (error) throw error;

    console.log('Successfully processed media item:', {
      correlation_id: messageMediaData.meta.correlation_id,
      media_id: mediaRecord.id,
      public_url: publicUrl
    });

    return { success: true, mediaId: mediaRecord.id };
  } catch (error) {
    console.error('Error processing media:', error);
    return { success: false, error: error.message };
  }
}