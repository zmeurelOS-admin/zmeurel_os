-- Farmer legal documents, safe public projection, association eligibility list,
-- private storage bucket, and publication guard for shop products.
--
-- Important design note:
-- `public.produse` already belongs to a farmer through `tenant_id`, which is
-- NOT NULL and already references `public.tenants(id)`. To avoid mutating
-- existing production rows, we expose an explicit `farmer_id` as a generated
-- mirror of `tenant_id`, instead of backfilling a second mutable FK column.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typnamespace = 'public'::regnamespace
      AND typname = 'farmer_legal_type'
  ) THEN
    CREATE TYPE public.farmer_legal_type AS ENUM (
      'certificat_producator',
      'pfa',
      'ii',
      'srl'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.farmer_legal_docs (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  full_name text,
  legal_type public.farmer_legal_type,
  certificate_series text,
  certificate_number text,
  certificate_expiry date,
  locality text,
  phone text,
  certificate_photo_url text,
  legal_accepted_at timestamptz,
  cui text,
  legal_docs_complete boolean GENERATED ALWAYS AS (
    (
      NULLIF(BTRIM(full_name), '') IS NOT NULL
      AND legal_type IS NOT NULL
      AND NULLIF(BTRIM(locality), '') IS NOT NULL
      AND NULLIF(BTRIM(phone), '') IS NOT NULL
      AND NULLIF(BTRIM(certificate_photo_url), '') IS NOT NULL
      AND legal_accepted_at IS NOT NULL
      AND (
        (
          legal_type = 'certificat_producator'
          AND NULLIF(BTRIM(certificate_series), '') IS NOT NULL
          AND NULLIF(BTRIM(certificate_number), '') IS NOT NULL
          AND certificate_expiry IS NOT NULL
        )
        OR (
          legal_type IN ('pfa', 'ii', 'srl')
          AND NULLIF(BTRIM(cui), '') IS NOT NULL
        )
      )
    )
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.farmer_legal_docs IS
  'Documente legale private pentru fermieri. Publicul nu citește direct din această tabelă.';
COMMENT ON COLUMN public.farmer_legal_docs.full_name IS
  'Nume și prenume folosit pe talonul digital public al producătorului.';
COMMENT ON COLUMN public.farmer_legal_docs.legal_type IS
  'Forma juridică folosită pentru badge-ul public și pentru validarea documentelor.';
COMMENT ON COLUMN public.farmer_legal_docs.certificate_series IS
  'Seria certificatului de producător, dacă legal_type = certificat_producator.';
COMMENT ON COLUMN public.farmer_legal_docs.certificate_number IS
  'Numărul certificatului de producător, dacă legal_type = certificat_producator.';
COMMENT ON COLUMN public.farmer_legal_docs.certificate_expiry IS
  'Data expirării vizei/documentului pentru certificatul de producător.';
COMMENT ON COLUMN public.farmer_legal_docs.locality IS
  'Localitatea de origine a produselor; poate fi afișată public în magazin.';
COMMENT ON COLUMN public.farmer_legal_docs.phone IS
  'Telefon de contact pentru conformitate legală și contact comercial.';
COMMENT ON COLUMN public.farmer_legal_docs.certificate_photo_url IS
  'Fișier privat din Storage (bucket legal-docs).';
COMMENT ON COLUMN public.farmer_legal_docs.legal_accepted_at IS
  'Momentul acceptării T&C și al confirmării afișării publice a datelor de identificare.';
COMMENT ON COLUMN public.farmer_legal_docs.cui IS
  'CUI obligatoriu pentru PFA/II/SRL.';
COMMENT ON COLUMN public.farmer_legal_docs.legal_docs_complete IS
  'TRUE doar dacă toate câmpurile obligatorii pentru forma juridică sunt completate și legal_accepted_at este setat.';

CREATE INDEX IF NOT EXISTS idx_farmer_legal_docs_complete
  ON public.farmer_legal_docs(legal_docs_complete);

CREATE OR REPLACE FUNCTION public.touch_farmer_legal_docs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS farmer_legal_docs_touch_updated_at ON public.farmer_legal_docs;
CREATE TRIGGER farmer_legal_docs_touch_updated_at
  BEFORE UPDATE ON public.farmer_legal_docs
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_farmer_legal_docs_updated_at();

ALTER TABLE public.farmer_legal_docs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS farmer_legal_docs_select_own ON public.farmer_legal_docs;
CREATE POLICY farmer_legal_docs_select_own
  ON public.farmer_legal_docs
  FOR SELECT
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS farmer_legal_docs_insert_own ON public.farmer_legal_docs;
CREATE POLICY farmer_legal_docs_insert_own
  ON public.farmer_legal_docs
  FOR INSERT
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS farmer_legal_docs_update_own ON public.farmer_legal_docs;
CREATE POLICY farmer_legal_docs_update_own
  ON public.farmer_legal_docs
  FOR UPDATE
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS farmer_legal_docs_delete_own ON public.farmer_legal_docs;
CREATE POLICY farmer_legal_docs_delete_own
  ON public.farmer_legal_docs
  FOR DELETE
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS farmer_legal_docs_select_superadmin ON public.farmer_legal_docs;
CREATE POLICY farmer_legal_docs_select_superadmin
  ON public.farmer_legal_docs
  FOR SELECT
  USING (public.is_superadmin());

DROP POLICY IF EXISTS farmer_legal_docs_update_superadmin ON public.farmer_legal_docs;
CREATE POLICY farmer_legal_docs_update_superadmin
  ON public.farmer_legal_docs
  FOR UPDATE
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'legal-docs',
  'legal-docs',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Farmers can upload own legal docs" ON storage.objects;
CREATE POLICY "Farmers can upload own legal docs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'legal-docs'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = public.current_tenant_id()::text
);

DROP POLICY IF EXISTS "Farmers can read own legal docs" ON storage.objects;
CREATE POLICY "Farmers can read own legal docs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'legal-docs'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = public.current_tenant_id()::text
);

DROP POLICY IF EXISTS "Farmers can update own legal docs" ON storage.objects;
CREATE POLICY "Farmers can update own legal docs"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'legal-docs'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = public.current_tenant_id()::text
)
WITH CHECK (
  bucket_id = 'legal-docs'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = public.current_tenant_id()::text
);

DROP POLICY IF EXISTS "Farmers can delete own legal docs" ON storage.objects;
CREATE POLICY "Farmers can delete own legal docs"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'legal-docs'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = public.current_tenant_id()::text
);

CREATE OR REPLACE FUNCTION public.is_legal_docs_complete(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE((
    SELECT fld.legal_docs_complete
    FROM public.farmer_legal_docs fld
    WHERE fld.tenant_id = p_tenant_id
  ), false);
$$;

REVOKE ALL ON FUNCTION public.is_legal_docs_complete(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_legal_docs_complete(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_legal_docs_complete(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_legal_docs_complete(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.list_association_farmer_legal_status()
RETURNS TABLE (
  tenant_id uuid,
  farm_name text,
  owner_user_id uuid,
  full_name text,
  locality text,
  logo_url text,
  legal_type public.farmer_legal_type,
  legal_docs_complete boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    t.id AS tenant_id,
    t.nume_ferma AS farm_name,
    t.owner_user_id,
    fld.full_name,
    COALESCE(NULLIF(BTRIM(fld.locality), ''), NULLIF(BTRIM(t.localitate), '')) AS locality,
    t.logo_url,
    fld.legal_type,
    COALESCE(fld.legal_docs_complete, false) AS legal_docs_complete
  FROM public.tenants t
  LEFT JOIN public.farmer_legal_docs fld
    ON fld.tenant_id = t.id
  WHERE COALESCE(t.is_demo, false) = false
    AND EXISTS (
      SELECT 1
      FROM public.association_members am
      WHERE am.user_id = auth.uid()
    )
  ORDER BY COALESCE(fld.legal_docs_complete, false) DESC, t.nume_ferma ASC;
$$;

COMMENT ON FUNCTION public.list_association_farmer_legal_status() IS
  'Projection pentru asociație: status legal docs + date publice minimale, fără certificat/foto/CUI.';

REVOKE ALL ON FUNCTION public.list_association_farmer_legal_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_association_farmer_legal_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_association_farmer_legal_status() TO service_role;

CREATE OR REPLACE FUNCTION public.get_public_farmer_card(p_tenant_id uuid)
RETURNS TABLE (
  tenant_id uuid,
  farm_name text,
  full_name text,
  locality text,
  logo_url text,
  legal_badge text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    t.id AS tenant_id,
    t.nume_ferma AS farm_name,
    fld.full_name,
    COALESCE(NULLIF(BTRIM(fld.locality), ''), NULLIF(BTRIM(t.localitate), '')) AS locality,
    t.logo_url,
    CASE fld.legal_type
      WHEN 'certificat_producator' THEN 'Certificat producător'
      WHEN 'pfa' THEN 'PFA'
      WHEN 'ii' THEN 'Întreprindere individuală'
      WHEN 'srl' THEN 'SRL'
      ELSE NULL
    END AS legal_badge
  FROM public.tenants t
  JOIN public.farmer_legal_docs fld
    ON fld.tenant_id = t.id
  WHERE t.id = p_tenant_id
    AND fld.legal_docs_complete = true;
$$;

COMMENT ON FUNCTION public.get_public_farmer_card(uuid) IS
  'Projection publică minimală: nume fermier, localitate, logo și badge legal; fără acces la documente private.';

REVOKE ALL ON FUNCTION public.get_public_farmer_card(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_farmer_card(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_farmer_card(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_farmer_card(uuid) TO service_role;

ALTER TABLE public.produse
  ADD COLUMN IF NOT EXISTS farmer_id uuid GENERATED ALWAYS AS (tenant_id) STORED;

COMMENT ON COLUMN public.produse.farmer_id IS
  'Legătură explicită cu fermierul/producătorul. Este un mirror generat din tenant_id pentru a evita backfill pe date existente.';

CREATE INDEX IF NOT EXISTS idx_produse_farmer_id
  ON public.produse(farmer_id);

CREATE OR REPLACE FUNCTION public.enforce_produse_requires_legal_docs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (
    (TG_OP = 'INSERT' AND (COALESCE(NEW.status, 'inactiv') = 'activ' OR COALESCE(NEW.association_listed, false) = true))
    OR
    (TG_OP = 'UPDATE' AND (
      (COALESCE(NEW.status, 'inactiv') = 'activ' AND COALESCE(OLD.status, 'inactiv') IS DISTINCT FROM COALESCE(NEW.status, 'inactiv'))
      OR
      (COALESCE(NEW.association_listed, false) = true AND COALESCE(OLD.association_listed, false) IS DISTINCT FROM COALESCE(NEW.association_listed, false))
      OR
      (OLD.tenant_id IS DISTINCT FROM NEW.tenant_id AND (COALESCE(NEW.status, 'inactiv') = 'activ' OR COALESCE(NEW.association_listed, false) = true))
    ))
  ) THEN
    IF NOT public.is_legal_docs_complete(NEW.tenant_id) THEN
      RAISE EXCEPTION 'Completează documentele legale înainte de publicarea produselor în Zmeurel OS.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS produse_legal_docs_guard ON public.produse;
CREATE TRIGGER produse_legal_docs_guard
  BEFORE INSERT OR UPDATE ON public.produse
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_produse_requires_legal_docs();

NOTIFY pgrst, 'reload schema';
