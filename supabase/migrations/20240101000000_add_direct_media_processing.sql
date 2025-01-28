-- Create function to process media directly from messages
CREATE OR REPLACE FUNCTION process_message_media()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process messages with media and status = 'pending'
  IF (NEW.status = 'pending' AND
      (NEW.message_data->>'photo' IS NOT NULL OR
       NEW.message_data->>'video' IS NOT NULL OR
       NEW.message_data->>'document' IS NOT NULL)) THEN

    -- Set status to processing to prevent duplicate processing
    NEW.status = 'processing';

    -- Queue Edge Function invocation for media processing
    INSERT INTO edge_functions_queue (
      function_name,
      payload,
      status
    ) VALUES (
      'process-message-media',
      jsonb_build_object(
        'message_id', NEW.id,
        'message_data', NEW.message_data,
        'analyzed_content', NEW.analyzed_content,
        'media_group_id', NEW.media_group_id,
        'message_url', NEW.message_url
      ),
      'pending'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_process_message_media ON messages;
CREATE TRIGGER trigger_process_message_media
  BEFORE INSERT OR UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION process_message_media();

-- Create edge_functions_queue table if not exists
CREATE TABLE IF NOT EXISTS edge_functions_queue (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  function_name text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  error_message text,
  retry_count int DEFAULT 0
);
