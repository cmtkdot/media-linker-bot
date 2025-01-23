import { calculateBackoffDelay, delay } from './retry-utils.ts';
import { MAX_RETRY_ATTEMPTS } from './constants.ts';

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
    // First try to update existing record
    const { error: updateError } = await supabase
      .from('failed_webhook_updates')
      .update({
        error_message: error.message,
        error_stack: error.stack,
        retry_count: retryCount,
        message_data: messageRecord?.message_data || {},
        status: retryCount >= MAX_RETRY_ATTEMPTS ? 'failed' : 'pending',
        last_retry_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .match({ 
        message_id: messageRecord?.message_id,
        chat_id: messageRecord?.chat_id 
      });

    // If no record exists or update failed, create a new one
    if (updateError) {
      const { error: insertError } = await supabase
        .from('failed_webhook_updates')
        .insert({
          message_id: messageRecord?.message_id,
          chat_id: messageRecord?.chat_id,
          error_message: error.message,
          error_stack: error.stack,
          retry_count: retryCount,
          message_data: messageRecord?.message_data || {},
          status: retryCount >= MAX_RETRY_ATTEMPTS ? 'failed' : 'pending',
          last_retry_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('Error logging failed webhook:', {
          error: insertError,
          message_id: messageRecord?.id || 'unknown'
        });
      }
    }

    // Update message status if we have a message record
    if (messageRecord?.id) {
      const { error: updateMessageError } = await supabase
        .from('messages')
        .update({
          retry_count: retryCount,
          last_retry_at: new Date().toISOString(),
          status: retryCount >= MAX_RETRY_ATTEMPTS ? 'failed' : 'pending',
          processing_error: error.message,
          updated_at: new Date().toISOString()
        })
        .eq('id', messageRecord.id);

      if (updateMessageError) {
        console.error('Error updating message status:', updateMessageError);
      }
    }

    // Handle rate limiting
    if (error.message?.includes('Too Many Requests') || error.code === 429) {
      const backoffDelay = calculateBackoffDelay(retryCount);
      console.log(`Rate limited. Waiting ${backoffDelay}ms before retry...`);
      await delay(backoffDelay);
    } else if (retryCount < MAX_RETRY_ATTEMPTS) {
      await delay(1000);
    }

    // Only throw if explicitly requested or max retries reached
    if (shouldThrow || retryCount >= MAX_RETRY_ATTEMPTS) {
      console.error('Max retry attempts reached or error throw requested:', {
        message_id: messageRecord?.id || 'unknown',
        total_attempts: retryCount,
        should_throw: shouldThrow
      });
      const finalError = new Error(`Failed after ${retryCount} attempts. Last error: ${error.message}`);
      finalError.retryCount = retryCount;
      throw finalError;
    }

    return {
      success: false,
      error: error.message,
      retryCount,
      shouldContinue: retryCount < MAX_RETRY_ATTEMPTS
    };
  } catch (handlingError) {
    console.error('Error in handleProcessingError:', {
      error: handlingError.message,
      original_error: error.message,
      message_id: messageRecord?.id || 'unknown'
    });
    
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