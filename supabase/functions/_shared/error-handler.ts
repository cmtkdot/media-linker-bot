import { calculateBackoffDelay, delay } from './retry-utils.ts';
import { MAX_RETRY_ATTEMPTS } from './constants.ts';

export enum ErrorType {
  DATABASE_TIMEOUT = 'DATABASE_TIMEOUT',
  NETWORK = 'NETWORK',
  VALIDATION = 'VALIDATION',
  MEDIA_PROCESSING = 'MEDIA_PROCESSING',
  STORAGE = 'STORAGE',
  DUPLICATE_MESSAGE = 'DUPLICATE_MESSAGE',
  UNKNOWN = 'UNKNOWN'
}

export interface ProcessingError extends Error {
  type: ErrorType;
  retryCount: number;
  messageId?: string;
  originalError?: any;
}

function classifyError(error: any): ErrorType {
  if (error.code === '23505' && error.message?.includes('messages_message_id_chat_id_key')) {
    return ErrorType.DUPLICATE_MESSAGE;
  }
  if (error.code === '57014' || error.message?.includes('timeout')) {
    return ErrorType.DATABASE_TIMEOUT;
  }
  if (error.message?.includes('network') || error.code === 'ECONNREFUSED') {
    return ErrorType.NETWORK;
  }
  if (error.message?.includes('validation') || error.code === '23514') {
    return ErrorType.VALIDATION;
  }
  if (error.message?.includes('media') || error.code === 'MEDIA_ERROR') {
    return ErrorType.MEDIA_PROCESSING;
  }
  if (error.message?.includes('storage') || error.code === 'STORAGE_ERROR') {
    return ErrorType.STORAGE;
  }
  return ErrorType.UNKNOWN;
}

export async function handleProcessingError(
  supabase: any,
  error: any,
  messageRecord: any,
  retryCount: number,
  shouldThrow = false
): Promise<{ success: boolean; error: string; retryCount: number; shouldContinue: boolean }> {
  const errorType = classifyError(error);
  
  console.error(`Processing error (${errorType}):`, {
    error: error.message,
    retry_count: retryCount,
    message_id: messageRecord?.id || 'unknown'
  });

  try {
    // For duplicate message errors, check if we have telegram media records
    if (errorType === ErrorType.DUPLICATE_MESSAGE && messageRecord) {
      console.log('Handling duplicate message case, checking for telegram media records...');
      
      const { data: existingMessage } = await supabase
        .from('messages')
        .select('id')
        .eq('message_id', messageRecord.message_id)
        .eq('chat_id', messageRecord.chat_id)
        .maybeSingle();

      if (existingMessage) {
        const { data: telegramMedia } = await supabase
          .from('telegram_media')
          .select('id')
          .eq('message_id', existingMessage.id)
          .limit(1);

        // If no telegram media exists, we should continue processing
        if (!telegramMedia || telegramMedia.length === 0) {
          console.log('No telegram media found for duplicate message, continuing processing...');
          return {
            success: true,
            error: '',
            retryCount,
            shouldContinue: true
          };
        }
      }
    }

    // Update error tracking
    const { error: updateError } = await supabase
      .from('failed_webhook_updates')
      .upsert({
        message_id: messageRecord?.message_id,
        chat_id: messageRecord?.chat_id,
        error_message: error.message,
        error_stack: error.stack,
        retry_count: retryCount,
        message_data: messageRecord?.message_data || {},
        status: retryCount >= MAX_RETRY_ATTEMPTS ? 'failed' : 'pending',
        last_retry_at: new Date().toISOString()
      });

    if (updateError) {
      console.error('Error logging failed webhook:', updateError);
    }

    // Update message status if we have a message record
    if (messageRecord?.id) {
      const { error: messageUpdateError } = await supabase
        .from('messages')
        .update({
          retry_count: retryCount,
          last_retry_at: new Date().toISOString(),
          status: retryCount >= MAX_RETRY_ATTEMPTS ? 'failed' : 'pending',
          processing_error: `${errorType}: ${error.message}`,
        })
        .eq('id', messageRecord.id);

      if (messageUpdateError) {
        console.error('Error updating message status:', messageUpdateError);
      }
    }

    // Handle specific error types
    switch (errorType) {
      case ErrorType.DATABASE_TIMEOUT:
      case ErrorType.NETWORK:
        const backoffDelay = calculateBackoffDelay(retryCount);
        console.log(`Waiting ${backoffDelay}ms before retry...`);
        await delay(backoffDelay);
        break;
      
      case ErrorType.VALIDATION:
      case ErrorType.MEDIA_PROCESSING:
      case ErrorType.STORAGE:
        // These errors might need manual intervention
        if (retryCount >= MAX_RETRY_ATTEMPTS) {
          console.error('Critical error requiring manual review:', {
            type: errorType,
            message: error.message,
            message_id: messageRecord?.id
          });
        }
        break;
    }

    if (shouldThrow || retryCount >= MAX_RETRY_ATTEMPTS) {
      const finalError = new Error(`Failed after ${retryCount} attempts. Last error: ${error.message}`);
      (finalError as ProcessingError).type = errorType;
      (finalError as ProcessingError).retryCount = retryCount;
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