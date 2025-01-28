import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { MessageMediaData } from '../../types/message-types.ts';
import { uploadToStorage } from '../storage/storage-service.ts';
import { downloadTelegramFile } from '../telegram/telegram-service.ts';

export async function processMediaItem(
  supabase: any,
  messageMediaData: MessageMediaData
): Promise<{ success: boolean; mediaId?: string; error?: string }> {
  try {
    console.log('Processing media item:', {
      message_id: messageMediaData.message?.message_id,
      file_id: messageMediaData.media?.file_id,
      file_type: messageMediaData.media?.file_type
    });

    // Validate required media data
    if (!messageMediaData.media?.file_id || 
        !messageMediaData.media?.file_unique_id || 
        !messageMediaData.media?.file_type) {
      throw new Error('Missing required media data fields');
    }

    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!botToken) throw new Error('Bot token not configured');

    // Download from Telegram
    const fileData = await downloadTelegramFile(messageMediaData.media.file_id, botToken);
    
    // Upload to storage
    const { publicUrl, storagePath } = await uploadToStorage(
      supabase,
      fileData.buffer,
      messageMediaData.media.file_unique_id,
      messageMediaData.media.file_type
    );

    // Create telegram_media record with complete data
    const { data: mediaRecord, error } = await supabase
      .from('telegram_media')
      .insert({
        file_id: messageMediaData.media.file_id,
        file_unique_id: messageMediaData.media.file_unique_id,
        file_type: messageMediaData.media.file_type,
        public_url: publicUrl,
        storage_path: storagePath,
        message_media_data: {
          ...messageMediaData,
          media: {
            ...messageMediaData.media,
            public_url: publicUrl,
            storage_path: storagePath
          }
        },
        correlation_id: messageMediaData.meta?.correlation_id,
        processed: true,
        caption: messageMediaData.message?.caption,
        is_original_caption: messageMediaData.meta?.is_original_caption,
        original_message_id: messageMediaData.meta?.original_message_id
      })
      .select()
      .single();

    if (error) throw error;

    console.log('Successfully processed media:', {
      media_id: mediaRecord.id,
      public_url: publicUrl
    });

    return { success: true, mediaId: mediaRecord.id };
  } catch (error) {
    console.error('Error processing media:', error);
    return { success: false, error: error.message };
  }
}