select
cron.schedule(
  'cleanup-queue-daily',
  '0 0 * * *', -- Run at midnight every day
  $$
  -- Delete processed items older than 24 hours
  DELETE FROM unified_processing_queue
  WHERE status = 'processed'
  AND processed_at < NOW() - INTERVAL '24 hours';
  
  -- Update failed items that have exceeded max retries
  UPDATE unified_processing_queue
  SET status = 'failed',
      error_message = COALESCE(error_message, '') || ' Max retries exceeded'
  WHERE status = 'pending'
  AND retry_count >= max_retries;
  $$
);