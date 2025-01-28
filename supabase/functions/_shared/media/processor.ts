import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { MediaFile } from './types.ts';
import { uploadMediaToStorage } from './storage.ts';
import { handleMediaError } from './error-handler.ts';

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

    // Check for existing record
    const { data: existingMedia } = await supabase
      .from('telegram_media')
      .select('*')
      .eq('file_unique_id', mediaFile.file_unique_id)
      .maybeSingle();

    // If exists, check for changes
    if (existingMedia) {
      const hasChanges = checkForChanges(existingMedia, message);
      if (!hasChanges) {
        console.log('No changes detected for existing media:', existingMedia.id);
        
        // Log the skip
        await supabase.from('media_processing_logs').insert({
          message_id: messageId,
          file_id: mediaFile.file_id,
          file_type: mediaFile.file_type,
          status: 'skipped',
          correlation_id: correlationId,
          processed_at: new Date().toISOString()
        });
        
        return;
      }
    }

    // Upload to storage and get URLs
    const { publicUrl, storagePath } = await uploadMediaToStorage(
      supabase,
      new ArrayBuffer(0), // Will be replaced with actual file in uploadMediaToStorage
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
        processed_at: new Date().toISOString(),
        correlation_id: correlationId
      }
    };

    // Update messages table
    const { error: messageError } = await supabase
      .from('messages')
      .update({
        message_media_data: updatedMediaData,
        status: 'processed',
        processed_at: new Date().toISOString()
      })
      .eq('id', messageId);

    if (messageError) throw messageError;

    // Create/Update telegram_media record
    const { error: mediaError } = await supabase
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

    if (mediaError) throw mediaError;

    // Log successful processing
    await supabase.from('media_processing_logs').insert({
      message_id: messageId,
      file_id: mediaFile.file_id,
      file_type: mediaFile.file_type,
      status: 'processed',
      storage_path: storagePath,
      correlation_id: correlationId,
      processed_at: new Date().toISOString()
    });

    console.log('Media processing completed successfully');

  } catch (error) {
    console.error('Media processing error:', error);
    
    await handleMediaError(
      supabase,
      error,
      messageId,
      correlationId,
      'processMediaMessage',
      message.retry_count || 0
    );

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

function checkForChanges(existingMedia: any, newMessage: any): boolean {
  // Check caption changes
  const existingCaption = existingMedia.message_media_data?.message?.caption;
  const newCaption = newMessage.message_media_data?.message?.caption;
  if (existingCaption !== newCaption) return true;

  // Check analyzed content changes
  const existingAnalysis = JSON.stringify(existingMedia.message_media_data?.analysis || {});
  const newAnalysis = JSON.stringify(newMessage.message_media_data?.analysis || {});
  if (existingAnalysis !== newAnalysis) return true;

  // Check media group changes
  const existingGroupId = existingMedia.message_media_data?.message?.media_group_id;
  const newGroupId = newMessage.message_media_data?.message?.media_group_id;
  if (existingGroupId !== newGroupId) return true;

  return false;
}