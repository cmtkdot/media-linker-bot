select
cron.schedule(
  'retry-pending-messages-every-5-minutes',
  '*/5 * * * *',
  $$
  select
    net.http_post(
        url:='https://kzfamethztziwqiocbwz.supabase.co/functions/v1/retry-pending-messages',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
    ) as request_id;
  $$
);