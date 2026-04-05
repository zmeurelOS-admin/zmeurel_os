-- Extinde profilul public al producătorului pentru vitrina asociației:
-- logo/foto, contacte publice și program opțional pentru piața volantă.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS facebook text,
  ADD COLUMN IF NOT EXISTS instagram text,
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS email_public text,
  ADD COLUMN IF NOT EXISTS program_piata text;

COMMENT ON COLUMN public.tenants.logo_url IS 'Logo sau foto principală pentru profilul public al producătorului.';
COMMENT ON COLUMN public.tenants.website IS 'Website public afișat pe profilul producătorului.';
COMMENT ON COLUMN public.tenants.facebook IS 'Link sau handle Facebook afișat pe profilul producătorului.';
COMMENT ON COLUMN public.tenants.instagram IS 'Link sau handle Instagram afișat pe profilul producătorului.';
COMMENT ON COLUMN public.tenants.whatsapp IS 'Număr WhatsApp afișat public pe profilul producătorului.';
COMMENT ON COLUMN public.tenants.email_public IS 'Adresă de email publică pentru profilul producătorului.';
COMMENT ON COLUMN public.tenants.program_piata IS 'Program piață volantă afișat doar când este completat.';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'producer-logos',
  'producer-logos',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Association staff can upload producer logos" ON storage.objects;
CREATE POLICY "Association staff can upload producer logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'producer-logos'
  AND EXISTS (
    SELECT 1
    FROM public.association_members am
    WHERE am.user_id = auth.uid()
      AND am.role IN ('admin', 'moderator')
  )
);

DROP POLICY IF EXISTS "Anyone can view producer logos" ON storage.objects;
CREATE POLICY "Anyone can view producer logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'producer-logos');

DROP POLICY IF EXISTS "Association staff can delete producer logos" ON storage.objects;
CREATE POLICY "Association staff can delete producer logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'producer-logos'
  AND EXISTS (
    SELECT 1
    FROM public.association_members am
    WHERE am.user_id = auth.uid()
      AND am.role IN ('admin', 'moderator')
  )
);

NOTIFY pgrst, 'reload schema';
