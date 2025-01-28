import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { MediaFile, MediaProcessingResult } from './media/types.ts';
import { uploadMediaToStorage } from './media/storage.ts';
import { validateMediaFile } from './media/validators.ts';

export async function processMediaMessage(
  supabase: ReturnType<typeof createClient>,
  message: Record<string, any>,
  botToken: string
): Promise<void> {
  const messageId = message.id;
  const correlationId = message.correlation_id;
  
  console.log('Starting media processing:', { messageId, correlationId });

  try {
    // 1. Log initial processing attempt
    await logMediaProcessing(supabase, {
      messageId,
      fileId: message.message_media_data?.media?.file_id,
      fileType: message.message_media_data?.media?.file_type,
      status: 'processing',
      correlationId
    });

    // 2. Extract and validate media file
    const mediaFile = extractMediaFile(message);
    if (!mediaFile) {
      throw new Error('No valid media file found in message');
    }

    // 3. Upload to storage and get URLs
    const { publicUrl, storagePath } = await uploadMediaToStorage(
      supabase,
      new ArrayBuffer(0),
      mediaFile.file_unique_id,
      mediaFile.file_type,
      botToken,
      mediaFile.file_id,
      mediaFile
    );

    // 4. Update message_media_data with storage info
    const updatedMediaData = {
      ...message.message_media_data,
      media: {
        ...mediaFile,
        public_url: publicUrl,
        storage_path: storagePath
      },
      meta: {
        ...message.message_media_data?.meta,
        status: 'processed',
        processed_at: new Date().toISOString()
      }
    };

    // 5. Update messages table
    await supabase
      .from('messages')
      .update({
        message_media_data: updatedMediaData,
        status: 'processed',
        processed_at: new Date().toISOString()
      })
      .eq('id', messageId);

    // 6. Create/Update telegram_media record
    await supabase
      .from('telegram_media')
      .upsert({
        message_id: messageId,
        file_id: mediaFile.file_id,
        file_unique_id: mediaFile.file_unique_id,
        file_type: mediaFile.file_type,
        public_url: publicUrl,
        storage_path: storagePath,
        message_media_data: updatedMediaData,
        correlation_id: correlationId,
        telegram_data: message.telegram_data,
        is_original_caption: message.is_original_caption,
        original_message_id: message.original_message_id,
        processed: true,
        updated_at: new Date().toISOString()
      });

    // 7. Log successful processing
    await logMediaProcessing(supabase, {
      messageId,
      fileId: mediaFile.file_id,
      fileType: mediaFile.file_type,
      status: 'processed',
      storagePath,
      correlationId
    });

    console.log('Media processing completed successfully');

  } catch (error) {
    console.error('Media processing error:', error);
    
    // Update message with error
    await supabase
      .from('messages')
      .update({
        status: 'error',
        processing_error: error.message,
        message_media_data: {
          ...message.message_media_data,
          meta: {
            ...message.message_media_data?.meta,
            status: 'error',
            error: error.message
          }
        }
      })
      .eq('id', messageId);

    // Log error
    await logMediaProcessing(supabase, {
      messageId,
      fileId: message.message_media_data?.media?.file_id,
      fileType: message.message_media_data?.media?.file_type,
      status: 'error',
      errorMessage: error.message,
      correlationId
    });

    throw error;
  }
}

async function logMediaProcessing(
  supabase: ReturnType<typeof createClient>,
  log: {
    messageId: string;
    fileId?: string;
    fileType?: string;
    status: 'processing' | 'processed' | 'error';
    storagePath?: string;
    errorMessage?: string;
    correlationId?: string;
  }
): Promise<void> {
  try {
    await supabase
      .from('media_processing_logs')
      .insert({
        message_id: log.messageId,
        file_id: log.fileId,
        file_type: log.fileType,
        status: log.status,
        storage_path: log.storagePath,
        error_message: log.errorMessage,
        correlation_id: log.correlationId,
        processed_at: log.status === 'processed' ? new Date().toISOString() : null
      });
  } catch (error) {
    console.error('Failed to log media processing:', error);
  }
}

function extractMediaFile(message: Record<string, any>): MediaFile | null {
  const telegramData = message.telegram_data;
  
  if (telegramData.video) {
    return {
      file_id: telegramData.video.file_id,
      file_unique_id: telegramData.video.file_unique_id,
      file_type: 'video',
      mime_type: telegramData.video.mime_type,
      file_size: telegramData.video.file_size,
      width: telegramData.video.width,
      height: telegramData.video.height,
      duration: telegramData.video.duration
    };
  }
  
  if (telegramData.photo) {
    const largestPhoto = telegramData.photo[telegramData.photo.length - 1];
    return {
      file_id: largestPhoto.file_id,
      file_unique_id: largestPhoto.file_unique_id,
      file_type: 'photo',
      file_size: largestPhoto.file_size,
      width: largestPhoto.width,
      height: largestPhoto.height
    };
  }

  if (telegramData.document) {
    return {
      file_id: telegramData.document.file_id,
      file_unique_id: telegramData.document.file_unique_id,
      file_type: 'document',
      mime_type: telegramData.document.mime_type,
      file_size: telegramData.document.file_size
    };
  }

  return null;
}