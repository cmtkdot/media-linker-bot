const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const DB_TIMEOUT_ERROR = '57014'; // Postgres error code for statement timeout

export async function withDatabaseRetry<T>(
  operation: () => Promise<T>,
  retryCount = 0,
  context?: string
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    console.error(`Database operation failed${context ? ` (${context})` : ''}: `, error);

    // Check if it's a database timeout error
    if ((error.code === DB_TIMEOUT_ERROR || error.message?.includes('statement timeout')) && retryCount < MAX_RETRIES) {
      console.log(`Database timeout, retrying (${retryCount + 1}/${MAX_RETRIES})...`);
      const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withDatabaseRetry(operation, retryCount + 1, context);
    }
    throw error;
  }
}