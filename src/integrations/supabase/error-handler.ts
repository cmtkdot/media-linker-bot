import { calculateBackoffDelay, delay } from './retry-utils';
import { MAX_RETRY_ATTEMPTS } from './constants';

export async function handleProcessingError(
  supabase: any,
  error: any,
  messageRecord: any,
  retryCount: number,
  shouldThrow = false
) {
  console.error(`Attempt ${retryCount + 1} failed:`, {
    error: error.message,
    stack: error.stack,
    message_id: messageRecord?.id || 'unknown',
    retry_count: retryCount
  });

  try {
    // Update message status if we have a message record
    if (messageRecord?.id) {
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
        console.error('Error updating message status:', updateError);
      }
    }

    // Handle rate limiting
    if (error.message?.includes('Too Many Requests') || error.code === 429) {
      const backoffDelay = calculateBackoffDelay(retryCount);
      console.log(`Rate limited. Waiting ${backoffDelay}ms before retry...`);
      await delay(backoffDelay);
    }

    if (shouldThrow || retryCount >= MAX_RETRY_ATTEMPTS) {
      throw error;
    }

    return {
      success: false,
      error: error.message,
      retryCount,
      shouldContinue: retryCount < MAX_RETRY_ATTEMPTS
    };
  } catch (handlingError) {
    console.error('Error in handleProcessingError:', handlingError);
    if (shouldThrow) {
      throw handlingError;
    }
    return {
      success: false,
      error: handlingError.message,
      retryCount,
      shouldContinue: false
    };
  }
}