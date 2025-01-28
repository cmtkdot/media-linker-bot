import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAX_RETRIES = 3;

export async function handleMediaError(
  supabase: ReturnType<typeof createClient>,
  error: unknown,
  messageId: string,
  correlationId: string,
  context: string,
  currentRetryCount: number
): Promise<void> {
  console.error('Media processing error:', {
    error,
    messageId,
    correlationId,
    context,
    currentRetryCount
  });

  const errorMessage = error instanceof Error ? error.message : String(error);
  const newRetryCount = currentRetryCount + 1;
  const isFinalRetry = newRetryCount >= MAX_RETRIES;

  // Get message data to ensure we have file_id for logging
  const { data: message } = await supabase
    .from('messages')
    .select('message_media_data')
    .eq('id', messageId)
    .single();

  const fileId = message?.message_media_data?.media?.file_id;
  const fileType = message?.message_media_data?.media?.file_type;

  // Update message status
  const { error: updateError } = await supabase
    .from('messages')
    .update({
      processing_error: errorMessage,
      retry_count: newRetryCount,
      last_retry_at: new Date().toISOString(),
      status: isFinalRetry ? 'error' : 'pending',
      message_media_data: message?.message_media_data ? {
        ...message.message_media_data,
        meta: {
          ...message.message_media_data.meta,
          error: errorMessage,
          status: isFinalRetry ? 'error' : 'pending',
          retry_count: newRetryCount,
          last_retry_at: new Date().toISOString()
        }
      } : undefined
    })
    .eq('id', messageId);

  if (updateError) {
    console.error('Error updating message status:', updateError);
  }

  // Only log if we have file_id
  if (fileId) {
    const { error: logError } = await supabase
      .from('media_processing_logs')
      .insert({
        message_id: messageId,
        file_id: fileId,
        file_type: fileType || 'unknown',
        error_message: errorMessage,
        retry_count: newRetryCount,
        status: 'error',
        correlation_id: correlationId
      });

    if (logError) {
      console.error('Error creating error log:', logError);
    }
  } else {
    console.warn('No file_id available for logging:', { messageId, correlationId });
  }

  // Update telegram_media record if it exists
  if (fileId) {
    const { error: mediaUpdateError } = await supabase
      .from('telegram_media')
      .update({
        processing_error: errorMessage,
        processed: false,
        message_media_data: message?.message_media_data
      })
      .eq('message_id', messageId);

    if (mediaUpdateError) {
      console.error('Error updating telegram_media:', mediaUpdateError);
    }
  }
}