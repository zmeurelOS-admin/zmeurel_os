-- Public association categories exposed to the public shop and filters.

CREATE TABLE IF NOT EXISTS public.association_categories (
  key text PRIMARY KEY,
  label text NOT NULL,
  sort_order smallint NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT association_categories_key_check
    CHECK (
      key IN (
        'fructe_legume',
        'lactate_branzeturi',
        'carne_mezeluri',
        'miere_apicole',
        'conserve_muraturi',
        'panificatie_patiserie',
        'bauturi',
        'oua',
        'altele'
      )
    )
);

COMMENT ON TABLE public.association_categories IS
  'Source of truth for public association shop categories.';

ALTER TABLE public.association_categories ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.association_categories TO anon;
GRANT SELECT ON public.association_categories TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'association_categories'
      AND policyname = 'association_categories_public_read'
  ) THEN
    CREATE POLICY association_categories_public_read
      ON public.association_categories
      FOR SELECT
      USING (is_active = true);
  END IF;
END $$;

INSERT INTO public.association_categories (key, label, sort_order)
VALUES
  ('fructe_legume', 'Fructe și legume', 10),
  ('lactate_branzeturi', 'Lactate și brânzeturi', 20),
  ('carne_mezeluri', 'Carne și mezeluri', 30),
  ('miere_apicole', 'Miere și produse apicole', 40),
  ('conserve_muraturi', 'Conserve și murături', 50),
  ('panificatie_patiserie', 'Panificație și patiserie', 60),
  ('bauturi', 'Băuturi (sucuri, siropuri)', 70),
  ('oua', 'Ouă', 80),
  ('altele', 'Altele', 90)
ON CONFLICT (key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
