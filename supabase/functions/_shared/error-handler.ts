import { calculateBackoffDelay, delay } from './retry-utils.ts';
import { MAX_RETRY_ATTEMPTS } from './constants.ts';

export async function handleProcessingError(
  supabase: any,
  error: any,
  messageRecord: any,
  retryCount: number
) {
  console.error(`Attempt ${retryCount + 1} failed:`, {
    error: error.message,
    stack: error.stack,
    message_id: messageRecord.id,
    retry_count: retryCount
  });

  // Update message with retry information
  const { error: updateError } = await supabase
    .from('messages')
    .update({
      retry_count: retryCount,
      last_retry_at: new Date().toISOString(),
      status: retryCount >= MAX_RETRY_ATTEMPTS ? 'failed' : 'pending',
      processing_error: error.message,
      updated_at: new Date().toISOString()
    })
    .eq('id', messageRecord.id);

  if (updateError) {
    console.error('Error updating retry information:', {
      error: updateError,
      message_id: messageRecord.id
    });
    throw updateError;
  }

  if (error.message?.includes('Too Many Requests') || error.code === 429) {
    const backoffDelay = calculateBackoffDelay(retryCount);
    console.log(`Rate limited. Waiting ${backoffDelay}ms before retry...`, {
      retry_count: retryCount,
      delay: backoffDelay
    });
    await delay(backoffDelay);
  } else if (retryCount < MAX_RETRY_ATTEMPTS) {
    await delay(1000); // Small delay for non-rate-limit errors
  }

  if (retryCount >= MAX_RETRY_ATTEMPTS) {
    console.error('Max retry attempts reached. Giving up.', {
      message_id: messageRecord.id,
      total_attempts: MAX_RETRY_ATTEMPTS
    });
    throw new Error(`Failed after ${MAX_RETRY_ATTEMPTS} attempts. Last error: ${error.message}`);
  }
}