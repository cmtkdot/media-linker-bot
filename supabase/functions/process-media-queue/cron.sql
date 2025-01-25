-- Enable required extensions
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Schedule the cron job to run every minute
select
  cron.schedule(
    'process-media-queue',
    '* * * * *',
    $$
    select
      net.http_post(
        url:='https://kzfamethztziwqiocbwz.supabase.co/functions/v1/process-media-queue',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
        body:='{"operation": "processQueue"}'::jsonb
      ) as request_id;
    $$
  );