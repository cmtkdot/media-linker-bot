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

  // Update message status
  const { error: updateError } = await supabase
    .from('messages')
    .update({
      processing_error: errorMessage,
      retry_count: newRetryCount,
      last_retry_at: new Date().toISOString(),
      status: isFinalRetry ? 'error' : 'pending'
    })
    .eq('id', messageId);

  if (updateError) {
    console.error('Error updating message status:', updateError);
  }

  // Log the error
  const { error: logError } = await supabase
    .from('media_processing_logs')
    .insert({
      message_id: messageId,
      error_message: errorMessage,
      retry_count: newRetryCount,
      status: 'error',
      correlation_id: correlationId
    });

  if (logError) {
    console.error('Error creating error log:', logError);
  }
}