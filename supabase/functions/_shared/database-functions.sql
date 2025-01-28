CREATE OR REPLACE FUNCTION update_media_records(
  p_message_id uuid,
  p_public_url text,
  p_storage_path text,
  p_message_media_data jsonb
) RETURNS void AS $$
BEGIN
  -- Update messages table
  UPDATE messages
  SET 
    status = 'processed',
    processed_at = NOW(),
    message_media_data = p_message_media_data
  WHERE id = p_message_id;

  -- Update telegram_media table
  UPDATE telegram_media
  SET 
    public_url = p_public_url,
    storage_path = p_storage_path,
    processed = true,
    message_media_data = p_message_media_data,
    updated_at = NOW()
  WHERE message_id = p_message_id;
END;
$$ LANGUAGE plpgsql;