import { INITIAL_RETRY_DELAY, MAX_BACKOFF_DELAY } from './constants.ts';

export function calculateBackoffDelay(retryCount: number): number {
  return Math.min(INITIAL_RETRY_DELAY * Math.pow(2, retryCount), MAX_BACKOFF_DELAY);
}

export async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}