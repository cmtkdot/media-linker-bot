-- Add caption column to telegram_media table
ALTER TABLE telegram_media 
ADD COLUMN IF NOT EXISTS caption text;

-- Backfill caption from message_media_data if it exists
UPDATE telegram_media
SET caption = message_media_data->>'caption'
WHERE message_media_data->>'caption' IS NOT NULL; 