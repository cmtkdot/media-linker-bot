import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { generateSafeFileName, getMimeType, uploadToStorage, validateStorageFile, updateMessageMediaData } from './storage-utils.ts';

export const processMediaUpload = async (
  supabase: ReturnType<typeof createClient>,
  messageId: string,
  fileBuffer: ArrayBuffer,
  messageMediaData: any
): Promise<void> => {
  try {
    const fileType = messageMediaData.media.file_type;
    const fileUniqueId = messageMediaData.media.file_unique_id;
    const mimeType = getMimeType(fileType);

    console.log('Processing media upload:', {
      messageId,
      fileType,
      fileUniqueId
    });

    const { publicUrl, storagePath } = await uploadToStorage(
      supabase,
      fileBuffer,
      fileUniqueId,
      fileType,
      mimeType
    );

    const updatedMediaData = updateMessageMediaData(
      messageMediaData,
      publicUrl,
      storagePath
    );

    // Update messages table with new media data
    const { error: messageError } = await supabase
      .from('messages')
      .update({
        message_media_data: updatedMediaData,
        status: 'processed',
        processed_at: new Date().toISOString()
      })
      .eq('id', messageId);

    if (messageError) {
      throw messageError;
    }

    // The telegram_media table will be automatically updated via triggers
    console.log('Media upload processed successfully:', {
      messageId,
      publicUrl,
      storagePath
    });
  } catch (error) {
    console.error('Error processing media upload:', error);
    throw error;
  }
};