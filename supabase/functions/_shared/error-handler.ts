import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export enum ErrorType {
  DATABASE_TIMEOUT = 'DATABASE_TIMEOUT',
  DATABASE_CONNECTION = 'DATABASE_CONNECTION',
  VALIDATION = 'VALIDATION',
  MEDIA_PROCESSING = 'MEDIA_PROCESSING',
  STORAGE = 'STORAGE',
  DUPLICATE_MESSAGE = 'DUPLICATE_MESSAGE',
  UNKNOWN = 'UNKNOWN'
}

interface ErrorHandlerResult {
  success: boolean;
  error: string;
  retryCount: number;
  shouldContinue?: boolean;
}

function classifyError(error: any): ErrorType {
  if (error.code === '23505' && error.message?.includes('messages_message_id_chat_id_key')) {
    return ErrorType.DUPLICATE_MESSAGE;
  }
  if (error.code === '57014' || error.message?.includes('timeout')) {
    return ErrorType.DATABASE_TIMEOUT;
  }
  if (error.code === '08006' || error.message?.includes('connection')) {
    return ErrorType.DATABASE_CONNECTION;
  }
  if (error.message?.includes('validation')) {
    return ErrorType.VALIDATION;
  }
  if (error.message?.includes('storage')) {
    return ErrorType.STORAGE;
  }
  if (error.message?.includes('media')) {
    return ErrorType.MEDIA_PROCESSING;
  }
  return ErrorType.UNKNOWN;
}

export async function handleProcessingError(
  supabase: any,
  error: any,
  messageRecord: any,
  retryCount: number,
  shouldRetry: boolean
): Promise<ErrorHandlerResult> {
  const errorType = classifyError(error);
  console.log('Processing error:', {
    type: errorType,
    message: error.message,
    code: error.code,
    retryCount,
    messageId: messageRecord?.id
  });

  try {
    // For duplicate message errors, check if we have telegram media records
    if (errorType === ErrorType.DUPLICATE_MESSAGE && messageRecord) {
      console.log('Handling duplicate message case, checking for telegram media records...');
      
      try {
        const { data: existingMessage, error: messageError } = await supabase
          .from('messages')
          .select('id')
          .eq('message_id', messageRecord.message_id)
          .eq('chat_id', messageRecord.chat_id)
          .maybeSingle();

        if (messageError) {
          console.error('Error fetching existing message:', messageError);
          throw messageError;
        }

        if (existingMessage) {
          const { data: telegramMedia, error: mediaError } = await supabase
            .from('telegram_media')
            .select('id')
            .eq('message_id', existingMessage.id)
            .limit(1);

          if (mediaError) {
            console.error('Error fetching telegram media:', mediaError);
            throw mediaError;
          }

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
      } catch (dbError) {
        console.error('Database error while checking for duplicates:', dbError);
        // Continue with error handling flow
      }
    }

    // Update error tracking
    const errorData = {
      message_id: messageRecord?.message_id,
      chat_id: messageRecord?.chat_id,
      error_message: error.message || 'Unknown error',
      error_stack: error.stack,
      retry_count: retryCount,
      last_retry_at: new Date().toISOString(),
      message_data: messageRecord,
      status: shouldRetry ? 'pending_retry' : 'failed'
    };

    const { error: updateError } = await supabase
      .from('failed_webhook_updates')
      .upsert([errorData], {
        onConflict: 'message_id,chat_id'
      });

    if (updateError) {
      console.error('Error updating failed_webhook_updates:', updateError);
    }

    // Update message status if we have a message record
    if (messageRecord?.id) {
      const { error: messageUpdateError } = await supabase
        .from('messages')
        .update({
          status: shouldRetry ? 'pending_retry' : 'failed',
          processing_error: error.message,
          retry_count: retryCount,
          last_retry_at: new Date().toISOString()
        })
        .eq('id', messageRecord.id);

      if (messageUpdateError) {
        console.error('Error updating message status:', messageUpdateError);
      }
    }

    return {
      success: false,
      error: error.message || 'Unknown error',
      retryCount,
      shouldContinue: false
    };

  } catch (handlerError) {
    console.error('Error in error handler:', handlerError);
    return {
      success: false,
      error: `Error handler failed: ${handlerError.message}`,
      retryCount,
      shouldContinue: false
    };
  }
}