import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { MediaFile } from './types.ts';
import { uploadMediaToStorage } from './storage-handler.ts';
import { handleMediaError } from './error-handler.ts';
import { validateMediaProcessing, validateMessageMediaData } from './validators.ts';

export async function processMediaMessage(
  supabase: ReturnType<typeof createClient>,
  message: Record<string, any>,
  botToken: string
): Promise<void> {
  const messageId = message.id;
  const correlationId = message.correlation_id;
  const isMediaGroup = !!message.media_group_id;
  
  console.log('Processing media message:', { messageId, correlationId, isMediaGroup });

  try {
    // Validate message media data first
    validateMessageMediaData(message.message_media_data);

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
        return;
      }
    }

    // Upload to storage and get URLs
    const { publicUrl, storagePath, isExisting } = await uploadMediaToStorage(
      supabase,
      new ArrayBuffer(0),
      mediaFile,
      botToken
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

    // Validate the complete message before marking as processed
    validateMediaProcessing(
      { ...message, message_media_data: updatedMediaData },
      isMediaGroup
    );

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

    console.log('Media processing completed successfully');

  } catch (error) {
    console.error('Media processing error:', error);
    await handleMediaError(
      supabase,
      error,
      messageId,
      correlationId
    );
    throw error;
  }
}

function extractMediaFile(message: Record<string, any>): MediaFile | null {
  const mediaData = message.message_media_data?.media;
  if (!mediaData) return null;

  return {
    file_id: mediaData.file_id,
    file_unique_id: mediaData.file_unique_id,
    file_type: mediaData.file_type,
    mime_type: mediaData.mime_type,
    file_size: mediaData.file_size,
    width: mediaData.width,
    height: mediaData.height,
    duration: mediaData.duration
  };
}

function checkForChanges(existingMedia: any, newMessage: any): boolean {
  const existingData = JSON.stringify(existingMedia.message_media_data);
  const newData = JSON.stringify(newMessage.message_media_data);
  return existingData !== newData;
}