INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'producer-photos',
  'producer-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Association staff can upload producer photos" ON storage.objects;
CREATE POLICY "Association staff can upload producer photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'producer-photos'
  AND EXISTS (
    SELECT 1
    FROM public.association_members am
    WHERE am.user_id = auth.uid()
      AND am.role IN ('admin', 'moderator')
  )
);

DROP POLICY IF EXISTS "Anyone can view producer photos" ON storage.objects;
CREATE POLICY "Anyone can view producer photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'producer-photos');

DROP POLICY IF EXISTS "Association staff can delete producer photos" ON storage.objects;
CREATE POLICY "Association staff can delete producer photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'producer-photos'
  AND EXISTS (
    SELECT 1
    FROM public.association_members am
    WHERE am.user_id = auth.uid()
      AND am.role IN ('admin', 'moderator')
  )
);

NOTIFY pgrst, 'reload schema';
