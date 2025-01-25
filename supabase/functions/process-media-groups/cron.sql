select
  cron.schedule(
    'process-media-groups-every-minute',
    '* * * * *',
    $$
    select
      net.http_post(
        url:='https://kzfamethztziwqiocbwz.supabase.co/functions/v1/process-media-groups',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6ZmFtZXRoenR6aXdxaW9jYnd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc0MjUwNTksImV4cCI6MjA1MzAwMTA1OX0.O7fKEwzBFsIl8dvDNBzNDQBb0egbINX1HO1n7mkSNKA"}'::jsonb,
        body:='{}'::jsonb
      ) as request_id;
    $$
);