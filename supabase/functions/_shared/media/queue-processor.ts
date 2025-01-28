import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { MediaFile } from './types.ts';

interface QueueProcessorOptions {
  messageId: string;
  correlationId: string;
  messageMediaData: Record<string, any>;
  telegramData: Record<string, any>;
  isOriginalCaption: boolean;
  originalMessageId?: string;
}

export async function processMediaQueue(
  supabase: ReturnType<typeof createClient>,
  options: QueueProcessorOptions
) {
  const {
    messageId,
    correlationId,
    messageMediaData,
    telegramData,
    isOriginalCaption,
    originalMessageId
  } = options;

  console.log('Processing media queue:', { messageId, correlationId });

  try {
    // Extract media information
    const mediaInfo = messageMediaData?.media;
    if (!mediaInfo?.file_id) {
      throw new Error('Invalid media information');
    }

    // Update telegram_media record
    const { error: mediaError } = await supabase
      .from('telegram_media')
      .upsert({
        message_id: messageId,
        file_id: mediaInfo.file_id,
        file_unique_id: mediaInfo.file_unique_id,
        file_type: mediaInfo.file_type,
        public_url: mediaInfo.public_url,
        storage_path: mediaInfo.storage_path,
        message_media_data: messageMediaData,
        correlation_id: correlationId,
        telegram_data: telegramData,
        is_original_caption: isOriginalCaption,
        original_message_id: originalMessageId,
        processed: true,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'message_id'
      });

    if (mediaError) {
      throw mediaError;
    }

    // Create processing log
    const { error: logError } = await supabase
      .from('media_processing_logs')
      .insert({
        message_id: messageId,
        file_id: mediaInfo.file_id,
        file_type: mediaInfo.file_type,
        status: 'processed',
        storage_path: mediaInfo.storage_path,
        correlation_id: correlationId,
        processed_at: new Date().toISOString()
      });

    if (logError) {
      console.error('Error creating processing log:', logError);
    }

    console.log('Media queue processing completed successfully');
    return true;
  } catch (error) {
    console.error('Error processing media queue:', error);

    // Log error
    try {
      await supabase
        .from('media_processing_logs')
        .insert({
          message_id: messageId,
          file_id: messageMediaData?.media?.file_id,
          file_type: messageMediaData?.media?.file_type,
          status: 'error',
          error_message: error.message,
          correlation_id: correlationId
        });
    } catch (logError) {
      console.error('Error creating error log:', logError);
    }

    throw error;
  }
}