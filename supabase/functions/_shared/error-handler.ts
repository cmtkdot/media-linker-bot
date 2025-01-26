import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function handleProcessingError(
  supabase: any,
  error: any,
  messageRecord: any,
  retryCount: number,
  isFinalAttempt: boolean
): Promise<{ shouldContinue: boolean }> {
  console.error('Processing error:', {
    error: error.message,
    stack: error.stack,
    message_id: messageRecord?.id,
    retry_count: retryCount
  });

  try {
    // Update the message record with error information
    if (messageRecord) {
      const { error: updateError } = await supabase
        .from('messages')
        .update({
          processing_error: error.message,
          retry_count: retryCount,
          last_retry_at: new Date().toISOString(),
          status: isFinalAttempt ? 'failed' : 'pending'
        })
        .eq('id', messageRecord.id);

      if (updateError) {
        console.error('Error updating message record:', updateError);
      }
    }

    return { shouldContinue: !isFinalAttempt };
  } catch (handlingError) {
    console.error('Error in error handler:', handlingError);
    return { shouldContinue: !isFinalAttempt };
  }
}