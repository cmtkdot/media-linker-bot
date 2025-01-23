const MAX_RETRIES = 3;
const INITIAL_DELAY = 1000;
const MAX_DELAY = 5000;

export async function withDatabaseRetry<T>(
  operation: () => Promise<T>,
  retryCount = 0
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    if (retryCount >= MAX_RETRIES) {
      throw error;
    }

    const delay = Math.min(
      INITIAL_DELAY * Math.pow(2, retryCount),
      MAX_DELAY
    );
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    return withDatabaseRetry(operation, retryCount + 1);
  }
}