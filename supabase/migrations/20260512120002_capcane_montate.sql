CREATE TABLE IF NOT EXISTS public.capcane_montate (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  parcela_id uuid NOT NULL REFERENCES public.parcele(id) ON DELETE RESTRICT,
  aplicare_id uuid REFERENCES public.aplicari_tratament(id) ON DELETE SET NULL,
  tip_capcana text NOT NULL CHECK (tip_capcana IN (
    'drosophila_otet',
    'lipicioasa_galbena',
    'lipicioasa_albastra',
    'feromonala',
    'altul'
  )),
  nr_bucati integer NOT NULL CHECK (nr_bucati > 0),
  data_montare date NOT NULL DEFAULT CURRENT_DATE,
  data_urmatoarea_verificare date,
  status text NOT NULL DEFAULT 'activ' CHECK (status IN ('activ', 'scos', 'expirat')),
  observatii text,
  foto_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_capcane_montate_parcela_status
  ON public.capcane_montate(parcela_id, status);

CREATE INDEX IF NOT EXISTS idx_capcane_montate_verificare
  ON public.capcane_montate(data_urmatoarea_verificare)
  WHERE status = 'activ';

ALTER TABLE public.capcane_montate ENABLE ROW LEVEL SECURITY;

CREATE POLICY capcane_montate_select ON public.capcane_montate
  FOR SELECT USING (tenant_id = public.current_tenant_id());

CREATE POLICY capcane_montate_insert ON public.capcane_montate
  FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY capcane_montate_update ON public.capcane_montate
  FOR UPDATE USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY capcane_montate_delete ON public.capcane_montate
  FOR DELETE USING (tenant_id = public.current_tenant_id());

CREATE TABLE IF NOT EXISTS public.capcane_verificari (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  capcana_montata_id uuid NOT NULL REFERENCES public.capcane_montate(id) ON DELETE CASCADE,
  aplicare_id uuid REFERENCES public.aplicari_tratament(id) ON DELETE SET NULL,
  data_verificare date NOT NULL DEFAULT CURRENT_DATE,
  nr_capturati integer CHECK (nr_capturati IS NULL OR nr_capturati >= 0),
  actiune text CHECK (actiune IS NULL OR actiune IN ('inlocuit', 'curatat', 'scos', 'doar_observat')),
  prag_depasit boolean DEFAULT false,
  observatii text,
  foto_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_capcane_verificari_capcana
  ON public.capcane_verificari(capcana_montata_id, data_verificare DESC);

ALTER TABLE public.capcane_verificari ENABLE ROW LEVEL SECURITY;

CREATE POLICY capcane_verificari_select ON public.capcane_verificari
  FOR SELECT USING (tenant_id = public.current_tenant_id());

CREATE POLICY capcane_verificari_insert ON public.capcane_verificari
  FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY capcane_verificari_update ON public.capcane_verificari
  FOR UPDATE USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY capcane_verificari_delete ON public.capcane_verificari
  FOR DELETE USING (tenant_id = public.current_tenant_id());
