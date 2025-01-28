-- Remove deprecated columns
ALTER TABLE telegram_media 
  DROP COLUMN IF EXISTS thumbnail_url,
  DROP COLUMN IF EXISTS default_public_url;

-- Drop deprecated functions
DROP FUNCTION IF EXISTS regenerate_all_video_thumbnails();
DROP FUNCTION IF EXISTS set_default_public_url();
DROP FUNCTION IF EXISTS extract_product_info();
DROP FUNCTION IF EXISTS sync_media_group_analyzed_content();

-- Update message_media_data function
CREATE OR REPLACE FUNCTION update_message_media_data()
RETURNS trigger AS $$
BEGIN
  NEW.message_media_data = jsonb_build_object(
    'message', jsonb_build_object(
      'url', NEW.message_url,
      'media_group_id', NEW.telegram_data->>'media_group_id',
      'caption', NEW.caption,
      'message_id', NEW.message_id,
      'chat_id', (NEW.telegram_data->'chat'->>'id')::bigint,
      'date', NEW.telegram_data->>'date'
    ),
    'sender', jsonb_build_object(
      'sender_info', COALESCE(NEW.telegram_data->'from', NEW.telegram_data->'sender_chat'),
      'chat_info', NEW.telegram_data->'chat'
    ),
    'analysis', jsonb_build_object(
      'analyzed_content', NEW.analyzed_content
    ),
    'meta', jsonb_build_object(
      'created_at', NEW.created_at::text,
      'updated_at', NOW()::text,
      'status', NEW.status,
      'error', NEW.processing_error
    ),
    'media', jsonb_build_object(
      'file_id', NEW.file_id,
      'file_unique_id', NEW.file_unique_id,
      'file_type', NEW.file_type,
      'public_url', NEW.public_url,
      'storage_path', NEW.storage_path
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update queue_media_processing function to use correct paths
CREATE OR REPLACE FUNCTION queue_media_processing()
RETURNS trigger AS $$
BEGIN
    INSERT INTO media_processing_queue (
        message_id,
        media_data,
        file_unique_id,
        correlation_id,
        priority
    ) VALUES (
        NEW.id,
        row_to_json(NEW),
        NEW.telegram_data->>'file_unique_id',
        NEW.correlation_id,
        CASE 
            WHEN NEW.telegram_data->>'media_group_id' IS NOT NULL THEN 2
            ELSE 1
        END
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql; 