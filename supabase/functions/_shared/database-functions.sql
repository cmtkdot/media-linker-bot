-- Function to sync telegram_media with messages based on storage files
CREATE OR REPLACE FUNCTION fn_sync_telegram_media()
RETURNS void AS $$
BEGIN
  -- Update existing records with latest message_media_data
  WITH latest_message AS (
    SELECT DISTINCT ON (m.message_media_data->'media'->>'file_id')
      m.id as message_id,
      m.message_media_data,
      m.is_original_caption,
      m.original_message_id,
      m.correlation_id,
      m.message_media_data->'media'->>'storage_path' as storage_path,
      m.message_media_data->'media'->>'file_id' as file_id
    FROM messages m
    WHERE m.message_media_data IS NOT NULL
    AND m.message_media_data->'media'->>'storage_path' IS NOT NULL
    ORDER BY m.message_media_data->'media'->>'file_id', m.created_at DESC
  )
  UPDATE telegram_media tm
  SET 
    message_id = lm.message_id,
    message_media_data = lm.message_media_data,
    public_url = lm.message_media_data->'media'->>'public_url',
    caption = lm.message_media_data->'message'->>'caption',
    analyzed_content = lm.message_media_data->'analysis'->>'analyzed_content',
    is_original_caption = lm.is_original_caption,
    original_message_id = lm.original_message_id,
    correlation_id = lm.correlation_id,
    updated_at = NOW()
  FROM latest_message lm
  WHERE tm.storage_path = lm.storage_path
  AND tm.file_id = lm.file_id;

  -- Insert new records for files that don't exist in telegram_media
  INSERT INTO telegram_media (
    file_id,
    file_unique_id,
    file_type,
    public_url,
    message_id,
    message_media_data,
    analyzed_content,
    is_original_caption,
    original_message_id,
    storage_path,
    caption,
    correlation_id,
    created_at,
    updated_at
  )
  SELECT DISTINCT ON (m.message_media_data->'media'->>'storage_path')
    m.message_media_data->'media'->>'file_id',
    m.message_media_data->'media'->>'file_unique_id',
    m.message_media_data->'media'->>'file_type',
    m.message_media_data->'media'->>'public_url',
    m.id,
    m.message_media_data,
    m.message_media_data->'analysis'->>'analyzed_content',
    m.is_original_caption,
    m.original_message_id,
    m.message_media_data->'media'->>'storage_path',
    m.message_media_data->'message'->>'caption',
    m.correlation_id,
    NOW(),
    NOW()
  FROM messages m
  WHERE m.message_media_data IS NOT NULL
  AND m.message_media_data->'media'->>'storage_path' IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM telegram_media tm2 
    WHERE tm2.storage_path = m.message_media_data->'media'->>'storage_path'
  );
END;
$$ LANGUAGE plpgsql;

-- Create a cron trigger to run every 5 minutes
SELECT cron.schedule(
  'sync_telegram_media',  -- name of the cron job
  '*/5 * * * *',         -- every 5 minutes
  'SELECT fn_sync_telegram_media()'
);

-- Remove file size constraints from telegram_media table
ALTER TABLE telegram_media 
  ALTER COLUMN file_size DROP NOT NULL,
  ALTER COLUMN file_size SET DEFAULT NULL;

-- Update existing records to ensure file_size can be NULL
UPDATE telegram_media 
SET file_size = NULL 
WHERE file_size = 0;

-- Add unique constraint on storage_path to ensure one record per file
ALTER TABLE telegram_media
  ADD CONSTRAINT unique_storage_path UNIQUE (storage_path);