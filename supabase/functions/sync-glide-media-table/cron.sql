select
  cron.schedule(
    'sync-glide-media',
    '*/5 * * * *',
    $$
    select net.http_post(
      'https://kzfamethztziwqiocbwz.supabase.co/functions/v1/sync-glide-media-table',
      '{}',
      '{}'::jsonb,
      array[
        ('Authorization', 'Bearer ' || (select value from secrets.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY'))::http_header
      ]
    );
    $$
  );