CREATE OR REPLACE FUNCTION public.extract_product_info()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Extract product info from caption if it exists
    IF (NEW.telegram_data->>'caption') IS NOT NULL THEN
        -- Extract product name (everything before the #)
        NEW.product_name := regexp_replace(
            split_part((NEW.telegram_data->>'caption'), '#', 1),
            '^\s+|\s+$', -- Remove leading/trailing whitespace
            '',
            'g'
        );
        
        -- Extract product code (text between # and x or end of string)
        NEW.product_code := regexp_replace(
            COALESCE(split_part(split_part((NEW.telegram_data->>'caption'), '#', 2), 'x', 1),
                     split_part((NEW.telegram_data->>'caption'), '#', 2)),
            '^\s+|\s+$',
            '',
            'g'
        );
        
        -- Extract quantity (number after x)
        NEW.quantity := nullif(regexp_replace(
            split_part((NEW.telegram_data->>'caption'), 'x', 2),
            '[^0-9.]',
            '',
            'g'
        ), '')::numeric;

        -- Extract vendor_uid (letters before numbers in product code)
        NEW.vendor_uid := regexp_replace(NEW.product_code, '[0-9].*$', '');

        -- Extract purchase date (6 digits after letters) and convert to proper date
        DECLARE
            date_str text;
            month_str text;
            day_str text;
            year_str text;
        BEGIN
            date_str := regexp_replace(NEW.product_code, '^[A-Za-z]+', '');
            IF length(date_str) >= 6 THEN
                month_str := substring(date_str from 1 for 2);
                day_str := substring(date_str from 3 for 2);
                year_str := '20' || substring(date_str from 5 for 2);
                
                -- Attempt to convert to date
                BEGIN
                    NEW.purchase_date := (year_str || '-' || month_str || '-' || day_str)::date;
                EXCEPTION WHEN OTHERS THEN
                    NEW.purchase_date := NULL;
                END;
            END IF;
        END;

        -- Extract notes (text in parentheses)
        NEW.notes := regexp_matches((NEW.telegram_data->>'caption'), '\((.*?)\)')::text[];
    END IF;
    
    -- Extract media metadata and set public URL
    NEW.media_metadata = jsonb_build_object(
        'file_size', (NEW.telegram_data->>'file_size')::int,
        'mime_type', NEW.telegram_data->>'mime_type',
        'width', (NEW.telegram_data->>'width')::int,
        'height', (NEW.telegram_data->>'height')::int,
        'duration', (NEW.telegram_data->>'duration')::int,
        'thumbnail', NEW.telegram_data->'thumbnail',
        'storage_path', NEW.telegram_data->>'storage_path',
        'bucket_id', 'media'
    );

    -- Set public_url if storage_path exists
    IF (NEW.telegram_data->>'storage_path') IS NOT NULL THEN
        NEW.public_url = 'https://kzfamethztziwqiocbwz.supabase.co/storage/v1/object/public/media/' || (NEW.telegram_data->>'storage_path');
    END IF;
    
    RETURN NEW;
END;
$function$;