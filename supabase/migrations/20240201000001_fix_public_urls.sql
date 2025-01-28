-- Function to get the correct public URL for a storage path
CREATE OR REPLACE FUNCTION get_public_url(storage_path text)
RETURNS text AS $$
BEGIN
  -- Use consistent URL format
  RETURN CASE
    WHEN storage_path IS NOT NULL
    THEN 'https://kzfamethztziwqiocbwz.supabase.co/storage/v1/object/public/media/' || storage_path
    ELSE NULL
  END;
END;
$$ LANGUAGE plpgsql;

-- Function to update message_media_data with new public URL
CREATE OR REPLACE FUNCTION update_message_media_data_url(message_data jsonb, new_url text)
RETURNS jsonb AS $$
BEGIN
  IF new_url IS NULL THEN
    RETURN message_data;
  END IF;

  -- Only update if media object exists
  IF message_data ? 'media' THEN
    RETURN jsonb_set(
      message_data,
      '{media,public_url}',
      to_jsonb(new_url)
    );
  END IF;

  RETURN message_data;
END;
$$ LANGUAGE plpgsql;

-- Main function to update public URLs
CREATE OR REPLACE FUNCTION update_public_urls()
RETURNS void AS $$
BEGIN
  -- Update telegram_media table
  UPDATE telegram_media tm
  SET
    public_url = get_public_url(tm.storage_path),
    message_media_data = update_message_media_data_url(
      tm.message_media_data,
      get_public_url(tm.storage_path)
    )
  WHERE storage_path IS NOT NULL;

  -- Update messages table to sync message_media_data
  UPDATE messages m
  SET message_media_data = tm.message_media_data
  FROM telegram_media tm
  WHERE m.id = tm.message_id
  AND tm.storage_path IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for automatic updates
CREATE OR REPLACE FUNCTION trigger_update_public_url()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.storage_path IS DISTINCT FROM OLD.storage_path THEN
    -- Update public_url
    NEW.public_url := get_public_url(NEW.storage_path);

    -- Update message_media_data
    NEW.message_media_data := update_message_media_data_url(
      NEW.message_media_data,
      NEW.public_url
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS update_public_url_trigger ON telegram_media;
CREATE TRIGGER update_public_url_trigger
  BEFORE UPDATE ON telegram_media
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_public_url();

-- Add validation trigger to ensure URLs are consistent
CREATE OR REPLACE FUNCTION validate_public_url()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure public_url matches storage_path
  IF NEW.storage_path IS NOT NULL AND NEW.public_url != get_public_url(NEW.storage_path) THEN
    RAISE EXCEPTION 'Public URL does not match storage path format';
  END IF;

  -- Ensure message_media_data.media.public_url matches
  IF NEW.message_media_data ? 'media'
     AND NEW.message_media_data->'media' ? 'public_url'
     AND NEW.message_media_data->'media'->>'public_url' != NEW.public_url THEN
    RAISE EXCEPTION 'message_media_data public_url does not match record public_url';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add validation trigger
DROP TRIGGER IF EXISTS validate_public_url_trigger ON telegram_media;
CREATE TRIGGER validate_public_url_trigger
  BEFORE INSERT OR UPDATE ON telegram_media
  FOR EACH ROW
  EXECUTE FUNCTION validate_public_url();

-- Run the update
SELECT update_public_urls();
