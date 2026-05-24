INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'capcane',
  'capcane',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can upload their own capcane photos'
  ) THEN
    CREATE POLICY "Users can upload their own capcane photos"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'capcane'
      AND (storage.foldername(name))[1] = (auth.jwt() ->> 'tenant_id')
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can view their own capcane photos'
  ) THEN
    CREATE POLICY "Users can view their own capcane photos"
    ON storage.objects FOR SELECT
    USING (
      bucket_id = 'capcane'
      AND (storage.foldername(name))[1] = (auth.jwt() ->> 'tenant_id')
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can delete their own capcane photos'
  ) THEN
    CREATE POLICY "Users can delete their own capcane photos"
    ON storage.objects FOR DELETE
    USING (
      bucket_id = 'capcane'
      AND (storage.foldername(name))[1] = (auth.jwt() ->> 'tenant_id')
    );
  END IF;
END $$;
