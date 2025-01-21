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

  try {
    // First try to update existing record
    const { error: updateError } = await supabase
      .from('failed_webhook_updates')
      .update({
        error_message: error.message,
        error_stack: error.stack,
        retry_count: retryCount,
        message_data: messageRecord.message_data,
        status: retryCount >= MAX_RETRY_ATTEMPTS ? 'failed' : 'pending',
        last_retry_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .match({ 
        message_id: messageRecord.message_id,
        chat_id: messageRecord.chat_id 
      });

    // If no record exists, create a new one
    if (updateError) {
      const { error: insertError } = await supabase
        .from('failed_webhook_updates')
        .insert({
          message_id: messageRecord.message_id,
          chat_id: messageRecord.chat_id,
          error_message: error.message,
          error_stack: error.stack,
          retry_count: retryCount,
          message_data: messageRecord.message_data,
          status: retryCount >= MAX_RETRY_ATTEMPTS ? 'failed' : 'pending',
          last_retry_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('Error logging failed webhook:', {
          error: insertError,
          message_id: messageRecord.id
        });
      }
    }

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

    if (updateMessageError) throw updateMessageError;

    if (error.message?.includes('Too Many Requests') || error.code === 429) {
      const backoffDelay = calculateBackoffDelay(retryCount);
      console.log(`Rate limited. Waiting ${backoffDelay}ms before retry...`);
      await delay(backoffDelay);
    } else if (retryCount < MAX_RETRY_ATTEMPTS) {
      await delay(1000);
    }

    if (retryCount >= MAX_RETRY_ATTEMPTS) {
      console.error('Max retry attempts reached. Giving up.', {
        message_id: messageRecord.id,
        total_attempts: MAX_RETRY_ATTEMPTS
      });
      const finalError = new Error(`Failed after ${MAX_RETRY_ATTEMPTS} attempts. Last error: ${error.message}`);
      finalError.retryCount = retryCount;
      throw finalError;
    }
  } catch (handlingError) {
    console.error('Error in handleProcessingError:', {
      error: handlingError.message,
      original_error: error.message,
      message_id: messageRecord.id
    });
    throw handlingError;
  }
}