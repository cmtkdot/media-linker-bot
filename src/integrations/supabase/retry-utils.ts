export function calculateBackoffDelay(retryCount: number): number {
  const baseDelay = 1000; // 1 second
  const maxDelay = 60000; // 1 minute
  const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
  return delay;
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}