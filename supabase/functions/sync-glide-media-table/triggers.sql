-- Create trigger function to queue changes
CREATE OR REPLACE FUNCTION queue_glide_sync() 
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO glide_sync_queue (
        table_name,
        record_id,
        operation,
        old_data,
        new_data
    ) VALUES (
        TG_TABLE_NAME,
        CASE
            WHEN TG_OP = 'DELETE' THEN OLD.id
            ELSE NEW.id
        END,
        TG_OP,
        CASE 
            WHEN TG_OP = 'DELETE' THEN row_to_json(OLD)
            WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD)
            ELSE NULL
        END,
        CASE 
            WHEN TG_OP = 'DELETE' THEN NULL
            ELSE row_to_json(NEW)
        END
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on telegram_media table
CREATE TRIGGER queue_telegram_media_changes
    AFTER INSERT OR UPDATE OR DELETE ON telegram_media
    FOR EACH ROW
    EXECUTE FUNCTION queue_glide_sync();