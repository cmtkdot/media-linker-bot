select cron.schedule(
  'retry-pending-messages',
  '*/5 * * * *', -- Run every 5 minutes
  $$
  select
    net.http_post(
      url := 'https://kzfamethztziwqiocbwz.supabase.co/functions/v1/retry-pending-messages',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.edge_function_key') || '"}',
      body := '{}'
    ) as request_id;
  $$
);