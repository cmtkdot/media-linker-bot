-- First remove any existing policies
DO $$ 
BEGIN
    BEGIN
        DROP POLICY IF EXISTS "Public Access" ON storage.objects;
    EXCEPTION 
        WHEN undefined_object THEN 
            NULL;
    END;
END $$;

-- Create new policy
CREATE POLICY "Public Access"
ON storage.objects FOR ALL
TO public
USING (bucket_id = 'media')
WITH CHECK (bucket_id = 'media');

-- Ensure bucket is public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'media';