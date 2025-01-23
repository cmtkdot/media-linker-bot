const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const DB_TIMEOUT_ERROR = '57014'; // Postgres error code for statement timeout

export async function withDatabaseRetry<T>(
  operation: () => Promise<T>,
  retryCount = 0,
  context?: string,
  maxRetries = MAX_RETRIES
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    console.error(`Database operation failed${context ? ` (${context})` : ''}: `, error);

    // Check if it's a database timeout error
    const isTimeout = error.code === DB_TIMEOUT_ERROR || 
                     error.message?.includes('statement timeout');
    
    if (isTimeout && retryCount < maxRetries) {
      const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
      console.log(`Database timeout, retrying (${retryCount + 1}/${maxRetries}) after ${delay}ms delay...`);
      
      // Add exponential backoff delay
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Retry with incremented count
      return withDatabaseRetry(operation, retryCount + 1, context, maxRetries);
    }

    // If we've exhausted retries or it's not a timeout error, throw
    console.error(`Operation failed after ${retryCount} retries:`, {
      error: error.message,
      code: error.code,
      context
    });
    throw error;
  }
}

// Helper to split large operations into smaller chunks
export async function withChunkedOperation<T>(
  items: T[],
  operation: (chunk: T[]) => Promise<void>,
  chunkSize = 5
): Promise<void> {
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    await operation(chunk);
    
    // Small delay between chunks to prevent overload
    if (i + chunkSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}