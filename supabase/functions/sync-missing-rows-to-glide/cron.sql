-- Enable the required extensions
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Schedule the cron job to run every 4 hours
select
  cron.schedule(
    'sync-missing-glide-records',
    '0 */4 * * *',
    $$
    select
      net.http_post(
        url:='https://kzfamethztziwqiocbwz.supabase.co/functions/v1/sync-missing-rows-to-glide',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
      ) as request_id;
    $$
  );