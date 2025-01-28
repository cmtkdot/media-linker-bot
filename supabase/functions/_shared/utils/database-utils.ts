import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const withDatabaseRetry = async <T>(
  operation: () => Promise<T>,
  retryCount = 0,
  operationName = 'database_operation',
  maxRetries = 3
): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    console.error(`Error in ${operationName}:`, {
      error: error.message,
      retry_count: retryCount
    });

    if (retryCount >= maxRetries) {
      throw error;
    }

    await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
    return withDatabaseRetry(operation, retryCount + 1, operationName, maxRetries);
  }
};