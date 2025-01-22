-- Enable the required extensions
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Schedule the cron job to run every 5 minutes
select
  cron.schedule(
    'process-glide-sync-queue',
    '*/5 * * * *',
    $$
    select
      net.http_post(
        url:='https://kzfamethztziwqiocbwz.supabase.co/functions/v1/sync-glide-media-table',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
        body:='{"operation": "processSyncQueue"}'::jsonb
      ) as request_id;
    $$
  );