const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 10000; // 10 seconds
const DB_TIMEOUT_ERROR = '57014'; // Postgres error code for statement timeout
const DEADLOCK_ERROR = '40P01'; // Postgres error code for deadlock
const CONNECTION_ERROR = '08006'; // Postgres connection error

export async function withDatabaseRetry<T>(
  operation: () => Promise<T>,
  retryCount = 0,
  context?: string
): Promise<T> {
  try {
    console.log(`Attempting database operation${context ? ` (${context})` : ''}, attempt ${retryCount + 1}/${MAX_RETRIES}`);
    return await operation();
  } catch (error: any) {
    console.error(`Database operation failed${context ? ` (${context})` : ''}: `, error);

    const isRetryableError = 
      error.code === DB_TIMEOUT_ERROR || 
      error.code === DEADLOCK_ERROR ||
      error.code === CONNECTION_ERROR ||
      error.message?.includes('statement timeout') ||
      error.message?.includes('connection lost');

    if (isRetryableError && retryCount < MAX_RETRIES) {
      console.log(`Retryable error detected, retrying (${retryCount + 1}/${MAX_RETRIES})...`);
      const delay = Math.min(INITIAL_RETRY_DELAY * Math.pow(2, retryCount), MAX_RETRY_DELAY);
      console.log(`Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withDatabaseRetry(operation, retryCount + 1, context);
    }

    console.error('Max retries reached or non-retryable error:', {
      error: error.message,
      code: error.code,
      context,
      retryCount
    });
    throw error;
  }
}