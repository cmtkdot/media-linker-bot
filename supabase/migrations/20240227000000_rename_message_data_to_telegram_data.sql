-- Drop triggers first
DROP TRIGGER IF EXISTS update_message_media_data_trigger ON messages;
DROP TRIGGER IF EXISTS update_message_media_data_trigger ON telegram_media;

-- Now safe to drop the function
DROP FUNCTION IF EXISTS update_message_media_data();

-- Rename message_data to telegram_data in messages table
ALTER TABLE messages RENAME COLUMN message_data TO telegram_data;

-- Create new function that works with telegram_data
CREATE OR REPLACE FUNCTION update_message_media_data()
RETURNS TRIGGER AS $$
BEGIN
  NEW.message_media_data = jsonb_build_object(
    'message', jsonb_build_object(
      'url', NEW.message_url,
      'media_group_id', NEW.media_group_id,
      'caption', NEW.caption,
      'message_id', (NEW.telegram_data->>'message_id')::bigint,
      'chat_id', (NEW.telegram_data->'chat'->>'id')::bigint,
      'date', (NEW.telegram_data->>'date')::bigint
    ),
    'sender', jsonb_build_object(
      'sender_info', COALESCE(NEW.telegram_data->'from', NEW.telegram_data->'sender_chat', '{}'::jsonb),
      'chat_info', COALESCE(NEW.telegram_data->'chat', '{}'::jsonb)
    ),
    'analysis', jsonb_build_object(
      'analyzed_content', COALESCE(NEW.analyzed_content, '{}'::jsonb)
    ),
    'meta', jsonb_build_object(
      'created_at', COALESCE(NEW.created_at::text, NOW()::text),
      'updated_at', NOW()::text,
      'status', NEW.status,
      'error', NULL
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate triggers on both tables
CREATE TRIGGER update_message_media_data_trigger
  BEFORE INSERT OR UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_message_media_data();

CREATE TRIGGER update_message_media_data_trigger
  BEFORE INSERT OR UPDATE ON telegram_media
  FOR EACH ROW
  EXECUTE FUNCTION update_message_media_data(); 