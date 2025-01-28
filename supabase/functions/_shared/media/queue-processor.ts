import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
      throw logError;
    }

    // If this is part of a media group and has original caption,
    // update other messages in the group
    if (messageMediaData.message?.media_group_id && isOriginalCaption) {
      const { error: groupError } = await supabase
        .from('messages')
        .update({
          message_media_data: {
            ...messageMediaData,
            meta: {
              ...messageMediaData.meta,
              is_original_caption: false,
              original_message_id: originalMessageId
            }
          }
        })
        .eq('media_group_id', messageMediaData.message.media_group_id)
        .neq('id', messageId);

      if (groupError) {
        console.error('Error updating media group:', groupError);
      }
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