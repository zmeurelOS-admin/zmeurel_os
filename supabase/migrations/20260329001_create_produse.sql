-- Module: Produse (product catalog)
-- Creates the produse table, RLS policies, storage bucket, and optional
-- columns on comenzi / vanzari for product linking.

-- ─── Main table ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.produse (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nume                TEXT        NOT NULL,
  descriere           TEXT,
  categorie           TEXT        NOT NULL DEFAULT 'fruct'
                      CHECK (categorie IN ('fruct', 'leguma', 'procesat', 'altele')),
  unitate_vanzare     TEXT        NOT NULL DEFAULT 'kg'
                      CHECK (unitate_vanzare IN ('kg', 'buc', 'ladă', 'casoletă', 'palet', 'cutie')),
  gramaj_per_unitate  NUMERIC,
  pret_unitar         NUMERIC,
  moneda              TEXT        NOT NULL DEFAULT 'RON',
  poza_1_url          TEXT,
  poza_2_url          TEXT,
  status              TEXT        NOT NULL DEFAULT 'activ'
                      CHECK (status IN ('activ', 'inactiv')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_produse_tenant ON public.produse(tenant_id);
CREATE INDEX IF NOT EXISTS idx_produse_tenant_status ON public.produse(tenant_id, status);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.produse ENABLE ROW LEVEL SECURITY;

CREATE POLICY "produse_select_tenant"
  ON public.produse FOR SELECT
  USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "produse_insert_tenant"
  ON public.produse FOR INSERT
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "produse_update_tenant"
  ON public.produse FOR UPDATE
  USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "produse_delete_tenant"
  ON public.produse FOR DELETE
  USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

-- ─── Optional FK columns on comenzi & vanzari ─────────────────────────────────

ALTER TABLE public.comenzi ADD COLUMN IF NOT EXISTS produs_id UUID REFERENCES public.produse(id) ON DELETE SET NULL;
ALTER TABLE public.vanzari  ADD COLUMN IF NOT EXISTS produs_id UUID REFERENCES public.produse(id) ON DELETE SET NULL;

-- ─── Storage bucket ───────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'produse-photos',
  'produse-photos',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Upload: tenant can only write to their own folder
CREATE POLICY "produse_photos_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'produse-photos'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = (
      SELECT tenant_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Read: any authenticated user (product photos are not secret)
CREATE POLICY "produse_photos_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'produse-photos');

-- Update (upsert): same restriction as insert
CREATE POLICY "produse_photos_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'produse-photos'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = (
      SELECT tenant_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Delete: tenant can only remove their own files
CREATE POLICY "produse_photos_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'produse-photos'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = (
      SELECT tenant_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
