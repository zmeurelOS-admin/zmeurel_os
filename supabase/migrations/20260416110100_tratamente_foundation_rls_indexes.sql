CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_produse_fitosanitare_tenant_id
  ON public.produse_fitosanitare(tenant_id);

CREATE INDEX IF NOT EXISTS idx_produse_fitosanitare_tenant_activ
  ON public.produse_fitosanitare(tenant_id, activ);

CREATE INDEX IF NOT EXISTS idx_planuri_tratament_tenant_id
  ON public.planuri_tratament(tenant_id);

CREATE INDEX IF NOT EXISTS idx_planuri_tratament_linii_tenant_id
  ON public.planuri_tratament_linii(tenant_id);

CREATE INDEX IF NOT EXISTS idx_planuri_tratament_linii_plan_ordine
  ON public.planuri_tratament_linii(plan_id, ordine);

CREATE INDEX IF NOT EXISTS idx_parcele_planuri_tenant_id
  ON public.parcele_planuri(tenant_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_parcele_planuri_active_unique
  ON public.parcele_planuri(parcela_id, an)
  WHERE activ = true;

CREATE INDEX IF NOT EXISTS idx_stadii_fenologice_parcela_tenant_id
  ON public.stadii_fenologice_parcela(tenant_id);

CREATE INDEX IF NOT EXISTS idx_stadii_fenologice_parcela_parcela_an_stadiu
  ON public.stadii_fenologice_parcela(parcela_id, an, stadiu);

CREATE INDEX IF NOT EXISTS idx_aplicari_tratament_tenant_id
  ON public.aplicari_tratament(tenant_id);

CREATE INDEX IF NOT EXISTS idx_aplicari_tratament_parcela_data_planificata
  ON public.aplicari_tratament(parcela_id, data_planificata DESC);

ALTER TABLE public.produse_fitosanitare ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planuri_tratament ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planuri_tratament_linii ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcele_planuri ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stadii_fenologice_parcela ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aplicari_tratament ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS produse_fitosanitare_select ON public.produse_fitosanitare;
CREATE POLICY produse_fitosanitare_select
  ON public.produse_fitosanitare
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IS NULL
    OR tenant_id = public.current_tenant_id()
  );

DROP POLICY IF EXISTS produse_fitosanitare_insert ON public.produse_fitosanitare;
CREATE POLICY produse_fitosanitare_insert
  ON public.produse_fitosanitare
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS produse_fitosanitare_update ON public.produse_fitosanitare;
CREATE POLICY produse_fitosanitare_update
  ON public.produse_fitosanitare
  FOR UPDATE
  TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS produse_fitosanitare_delete ON public.produse_fitosanitare;
CREATE POLICY produse_fitosanitare_delete
  ON public.produse_fitosanitare
  FOR DELETE
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS planuri_tratament_select ON public.planuri_tratament;
CREATE POLICY planuri_tratament_select
  ON public.planuri_tratament
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS planuri_tratament_insert ON public.planuri_tratament;
CREATE POLICY planuri_tratament_insert
  ON public.planuri_tratament
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS planuri_tratament_update ON public.planuri_tratament;
CREATE POLICY planuri_tratament_update
  ON public.planuri_tratament
  FOR UPDATE
  TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS planuri_tratament_delete ON public.planuri_tratament;
CREATE POLICY planuri_tratament_delete
  ON public.planuri_tratament
  FOR DELETE
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS planuri_tratament_linii_select ON public.planuri_tratament_linii;
CREATE POLICY planuri_tratament_linii_select
  ON public.planuri_tratament_linii
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS planuri_tratament_linii_insert ON public.planuri_tratament_linii;
CREATE POLICY planuri_tratament_linii_insert
  ON public.planuri_tratament_linii
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS planuri_tratament_linii_update ON public.planuri_tratament_linii;
CREATE POLICY planuri_tratament_linii_update
  ON public.planuri_tratament_linii
  FOR UPDATE
  TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS planuri_tratament_linii_delete ON public.planuri_tratament_linii;
CREATE POLICY planuri_tratament_linii_delete
  ON public.planuri_tratament_linii
  FOR DELETE
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS parcele_planuri_select ON public.parcele_planuri;
CREATE POLICY parcele_planuri_select
  ON public.parcele_planuri
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS parcele_planuri_insert ON public.parcele_planuri;
CREATE POLICY parcele_planuri_insert
  ON public.parcele_planuri
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS parcele_planuri_update ON public.parcele_planuri;
CREATE POLICY parcele_planuri_update
  ON public.parcele_planuri
  FOR UPDATE
  TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS parcele_planuri_delete ON public.parcele_planuri;
CREATE POLICY parcele_planuri_delete
  ON public.parcele_planuri
  FOR DELETE
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS stadii_fenologice_parcela_select ON public.stadii_fenologice_parcela;
CREATE POLICY stadii_fenologice_parcela_select
  ON public.stadii_fenologice_parcela
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS stadii_fenologice_parcela_insert ON public.stadii_fenologice_parcela;
CREATE POLICY stadii_fenologice_parcela_insert
  ON public.stadii_fenologice_parcela
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS stadii_fenologice_parcela_update ON public.stadii_fenologice_parcela;
CREATE POLICY stadii_fenologice_parcela_update
  ON public.stadii_fenologice_parcela
  FOR UPDATE
  TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS stadii_fenologice_parcela_delete ON public.stadii_fenologice_parcela;
CREATE POLICY stadii_fenologice_parcela_delete
  ON public.stadii_fenologice_parcela
  FOR DELETE
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS aplicari_tratament_select ON public.aplicari_tratament;
CREATE POLICY aplicari_tratament_select
  ON public.aplicari_tratament
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS aplicari_tratament_insert ON public.aplicari_tratament;
CREATE POLICY aplicari_tratament_insert
  ON public.aplicari_tratament
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS aplicari_tratament_update ON public.aplicari_tratament;
CREATE POLICY aplicari_tratament_update
  ON public.aplicari_tratament
  FOR UPDATE
  TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS aplicari_tratament_delete ON public.aplicari_tratament;
CREATE POLICY aplicari_tratament_delete
  ON public.aplicari_tratament
  FOR DELETE
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP TRIGGER IF EXISTS produse_fitosanitare_touch_updated_at ON public.produse_fitosanitare;
CREATE TRIGGER produse_fitosanitare_touch_updated_at
  BEFORE UPDATE ON public.produse_fitosanitare
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS planuri_tratament_touch_updated_at ON public.planuri_tratament;
CREATE TRIGGER planuri_tratament_touch_updated_at
  BEFORE UPDATE ON public.planuri_tratament
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS planuri_tratament_linii_touch_updated_at ON public.planuri_tratament_linii;
CREATE TRIGGER planuri_tratament_linii_touch_updated_at
  BEFORE UPDATE ON public.planuri_tratament_linii
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS parcele_planuri_touch_updated_at ON public.parcele_planuri;
CREATE TRIGGER parcele_planuri_touch_updated_at
  BEFORE UPDATE ON public.parcele_planuri
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS stadii_fenologice_parcela_touch_updated_at ON public.stadii_fenologice_parcela;
CREATE TRIGGER stadii_fenologice_parcela_touch_updated_at
  BEFORE UPDATE ON public.stadii_fenologice_parcela
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS aplicari_tratament_touch_updated_at ON public.aplicari_tratament;
CREATE TRIGGER aplicari_tratament_touch_updated_at
  BEFORE UPDATE ON public.aplicari_tratament
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

NOTIFY pgrst, 'reload schema';
