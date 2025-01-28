import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { MediaProcessingError } from './types.ts';

export class MediaProcessingError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any,
    public retryable: boolean = true
  ) {
    super(message);
    this.name = 'MediaProcessingError';
  }
}

export async function handleMediaError(
  supabase: ReturnType<typeof createClient>,
  error: any,
  messageId: string,
  correlationId: string,
  context: string,
  retryCount: number = 0
): Promise<{ shouldRetry: boolean; error: MediaProcessingError }> {
  console.error(`Error in ${context}:`, {
    error: error.message,
    code: error.code,
    messageId,
    correlationId,
    retryCount
  });

  // Determine if error is retryable
  const isRetryable = 
    error instanceof MediaProcessingError ? error.retryable :
    error.code === '23505' ? false : // Unique constraint violation
    error.code === '23503' ? false : // Foreign key violation
    true;

  // Create standardized error
  const processingError = error instanceof MediaProcessingError ? error :
    new MediaProcessingError(
      error.message || 'Unknown error occurred',
      error.code || 'UNKNOWN_ERROR',
      error.details,
      isRetryable
    );

  try {
    // Update message status
    await supabase
      .from('messages')
      .update({
        status: isRetryable ? 'pending' : 'failed',
        processing_error: processingError.message,
        retry_count: retryCount,
        last_retry_at: new Date().toISOString()
      })
      .eq('id', messageId);

    // Log error
    await supabase
      .from('media_processing_logs')
      .insert({
        message_id: messageId,
        correlation_id: correlationId,
        error_message: processingError.message,
        status: isRetryable ? 'pending' : 'failed',
        retry_count: retryCount
      });

    return {
      shouldRetry: isRetryable && retryCount < 3,
      error: processingError
    };
  } catch (loggingError) {
    console.error('Error logging media processing error:', loggingError);
    return {
      shouldRetry: isRetryable && retryCount < 3,
      error: processingError
    };
  }
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  context: string,
  messageId: string,
  correlationId: string,
  supabase: ReturnType<typeof createClient>,
  maxRetries: number = 3,
  retryCount: number = 0
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const { shouldRetry, error: processedError } = await handleMediaError(
      supabase,
      error,
      messageId,
      correlationId,
      context,
      retryCount
    );

    if (shouldRetry && retryCount < maxRetries) {
      const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(
        operation,
        context,
        messageId,
        correlationId,
        supabase,
        maxRetries,
        retryCount + 1
      );
    }

    throw processedError;
  }
}