export const INITIAL_RETRY_DELAY = 1000; // 1 second
export const MAX_BACKOFF_DELAY = 30000; // 30 seconds
export const MAX_RETRY_ATTEMPTS = 5;

// Add cleanup function for successful webhooks
export const cleanup_successful_webhooks = `
  CREATE OR REPLACE FUNCTION public.cleanup_successful_webhooks()
  RETURNS void
  LANGUAGE plpgsql
  AS $$
  BEGIN
    DELETE FROM pending_webhook_updates 
    WHERE status = 'success' 
    AND created_at < NOW() - INTERVAL '1 week';
  END;
  $$;
`;
