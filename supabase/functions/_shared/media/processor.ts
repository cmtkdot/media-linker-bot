import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { MediaFile } from './types.ts';
import { uploadMediaToStorage } from './storage.ts';
import { processMediaQueue } from './queue-processor.ts';

export async function processMediaMessage(
  supabase: ReturnType<typeof createClient>,
  message: Record<string, any>,
  botToken: string
): Promise<void> {
  const messageId = message.id;
  const correlationId = message.correlation_id;
  
  console.log('Processing media message:', { messageId, correlationId });

  try {
    // Extract media file data
    const mediaFile = extractMediaFile(message);
    if (!mediaFile) {
      throw new Error('No valid media file found in message');
    }

    console.log('Extracted media file:', mediaFile);

    // Upload to storage and get URLs
    const { publicUrl, storagePath } = await uploadMediaToStorage(
      supabase,
      new ArrayBuffer(0),
      mediaFile.file_unique_id,
      mediaFile.file_type,
      botToken,
      mediaFile.file_id,
      mediaFile
    );

    // Update message_media_data with storage info
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

    // Update messages table
    await supabase
      .from('messages')
      .update({
        message_media_data: updatedMediaData,
        status: 'processed',
        processed_at: new Date().toISOString()
      })
      .eq('id', messageId);

    // Process media queue
    await processMediaQueue(supabase, {
      messageId,
      correlationId,
      messageMediaData: updatedMediaData,
      telegramData: message.telegram_data,
      isOriginalCaption: message.is_original_caption,
      originalMessageId: message.original_message_id
    });

    console.log('Media processing completed successfully');

  } catch (error) {
    console.error('Media processing error:', error);
    
    // Update message with error
    await supabase
      .from('messages')
      .update({
        status: 'error',
        processing_error: error.message
      })
      .eq('id', messageId);

    throw error;
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