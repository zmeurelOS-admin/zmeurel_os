CREATE TABLE IF NOT EXISTS public.configurari_parcela_sezon (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  parcela_id uuid NOT NULL REFERENCES public.parcele(id) ON DELETE CASCADE,
  an integer NOT NULL,
  sistem_conducere text
    CHECK (sistem_conducere IN ('primocane_only', 'mixt_floricane_primocane')),
  tip_ciclu_soi text
    CHECK (tip_ciclu_soi IN ('determinat', 'nedeterminat')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT configurari_parcela_sezon_parcela_an_key
    UNIQUE (parcela_id, an)
);

CREATE INDEX IF NOT EXISTS idx_configurari_parcela_sezon_tenant_parcela_an
  ON public.configurari_parcela_sezon(tenant_id, parcela_id, an);

ALTER TABLE public.configurari_parcela_sezon ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'configurari_parcela_sezon'
      AND policyname = 'configurari_parcela_sezon_select'
  ) THEN
    CREATE POLICY configurari_parcela_sezon_select
      ON public.configurari_parcela_sezon
      FOR SELECT
      TO authenticated
      USING (tenant_id = public.current_tenant_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'configurari_parcela_sezon'
      AND policyname = 'configurari_parcela_sezon_insert'
  ) THEN
    CREATE POLICY configurari_parcela_sezon_insert
      ON public.configurari_parcela_sezon
      FOR INSERT
      TO authenticated
      WITH CHECK (tenant_id = public.current_tenant_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'configurari_parcela_sezon'
      AND policyname = 'configurari_parcela_sezon_update'
  ) THEN
    CREATE POLICY configurari_parcela_sezon_update
      ON public.configurari_parcela_sezon
      FOR UPDATE
      TO authenticated
      USING (tenant_id = public.current_tenant_id())
      WITH CHECK (tenant_id = public.current_tenant_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'configurari_parcela_sezon'
      AND policyname = 'configurari_parcela_sezon_delete'
  ) THEN
    CREATE POLICY configurari_parcela_sezon_delete
      ON public.configurari_parcela_sezon
      FOR DELETE
      TO authenticated
      USING (tenant_id = public.current_tenant_id());
  END IF;
END
$$;

DROP TRIGGER IF EXISTS configurari_parcela_sezon_touch_updated_at ON public.configurari_parcela_sezon;
CREATE TRIGGER configurari_parcela_sezon_touch_updated_at
  BEFORE UPDATE ON public.configurari_parcela_sezon
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

