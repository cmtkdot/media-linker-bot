select
  cron.schedule(
    'process-media-queue', -- name of the cron job
    '* * * * *', -- every minute
    $$
    select net.http_post(
      'https://kzfamethztziwqiocbwz.supabase.co/functions/v1/process-media-queue',
      '{}',
      '{}'::jsonb,
      array[
        ('Authorization', 'Bearer ' || (select value from secrets.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY'))::http_header
      ]
    );
    $$
  );