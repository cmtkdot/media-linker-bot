const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

export async function withDatabaseRetry<T>(
  operation: () => Promise<T>,
  retryCount = 0
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    // Check if it's a database timeout error
    if (error.code === '57014' && retryCount < MAX_RETRIES) {
      console.log(`Database timeout, retrying (${retryCount + 1}/${MAX_RETRIES})...`);
      const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withDatabaseRetry(operation, retryCount + 1);
    }
    throw error;
  }
}