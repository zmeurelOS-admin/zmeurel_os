-- Tratamente V2: liniile de plan devin interventii, iar produsele devin randuri copil.
-- Campurile legacy de produs/doza raman pe tabelele V1 pentru fallback temporar.

ALTER TABLE public.planuri_tratament_linii
  ADD COLUMN IF NOT EXISTS tip_interventie text,
  ADD COLUMN IF NOT EXISTS scop text,
  ADD COLUMN IF NOT EXISTS regula_repetare text NOT NULL DEFAULT 'fara_repetare',
  ADD COLUMN IF NOT EXISTS interval_repetare_zile integer,
  ADD COLUMN IF NOT EXISTS numar_repetari_max integer,
  ADD COLUMN IF NOT EXISTS fereastra_start_offset_zile integer,
  ADD COLUMN IF NOT EXISTS fereastra_end_offset_zile integer;

ALTER TABLE public.aplicari_tratament
  ADD COLUMN IF NOT EXISTS sursa text NOT NULL DEFAULT 'din_plan',
  ADD COLUMN IF NOT EXISTS tip_interventie text,
  ADD COLUMN IF NOT EXISTS scop text,
  ADD COLUMN IF NOT EXISTS stadiu_fenologic_id uuid REFERENCES public.stadii_fenologice_parcela(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS diferente_fata_de_plan jsonb;

UPDATE public.aplicari_tratament
SET sursa = CASE
  WHEN plan_linie_id IS NULL THEN 'manuala'
  ELSE 'din_plan'
END
WHERE sursa IS NULL
   OR sursa NOT IN ('din_plan', 'manuala')
   OR (plan_linie_id IS NULL AND sursa = 'din_plan');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'planuri_tratament_linii_tip_interventie_check'
      AND conrelid = 'public.planuri_tratament_linii'::regclass
  ) THEN
    ALTER TABLE public.planuri_tratament_linii
      ADD CONSTRAINT planuri_tratament_linii_tip_interventie_check
      CHECK (
        tip_interventie IS NULL
        OR tip_interventie IN (
          'protectie',
          'nutritie',
          'biostimulare',
          'erbicidare',
          'igiena',
          'monitorizare',
          'altul'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'planuri_tratament_linii_regula_repetare_check'
      AND conrelid = 'public.planuri_tratament_linii'::regclass
  ) THEN
    ALTER TABLE public.planuri_tratament_linii
      ADD CONSTRAINT planuri_tratament_linii_regula_repetare_check
      CHECK (regula_repetare IN ('fara_repetare', 'interval'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'planuri_tratament_linii_repetare_valori_check'
      AND conrelid = 'public.planuri_tratament_linii'::regclass
  ) THEN
    ALTER TABLE public.planuri_tratament_linii
      ADD CONSTRAINT planuri_tratament_linii_repetare_valori_check
      CHECK (
        (interval_repetare_zile IS NULL OR interval_repetare_zile >= 1)
        AND (numar_repetari_max IS NULL OR numar_repetari_max >= 1)
        AND (
          fereastra_start_offset_zile IS NULL
          OR fereastra_end_offset_zile IS NULL
          OR fereastra_start_offset_zile <= fereastra_end_offset_zile
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'aplicari_tratament_sursa_check'
      AND conrelid = 'public.aplicari_tratament'::regclass
  ) THEN
    ALTER TABLE public.aplicari_tratament
      ADD CONSTRAINT aplicari_tratament_sursa_check
      CHECK (sursa IN ('din_plan', 'manuala'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'aplicari_tratament_tip_interventie_check'
      AND conrelid = 'public.aplicari_tratament'::regclass
  ) THEN
    ALTER TABLE public.aplicari_tratament
      ADD CONSTRAINT aplicari_tratament_tip_interventie_check
      CHECK (
        tip_interventie IS NULL
        OR tip_interventie IN (
          'protectie',
          'nutritie',
          'biostimulare',
          'erbicidare',
          'igiena',
          'monitorizare',
          'altul'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'aplicari_tratament_sursa_plan_linie_check'
      AND conrelid = 'public.aplicari_tratament'::regclass
  ) THEN
    ALTER TABLE public.aplicari_tratament
      ADD CONSTRAINT aplicari_tratament_sursa_plan_linie_check
      CHECK (
        sursa = 'din_plan'
        OR (sursa = 'manuala' AND plan_linie_id IS NULL)
      );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.planuri_tratament_linie_produse (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_linie_id uuid NOT NULL REFERENCES public.planuri_tratament_linii(id) ON DELETE CASCADE,
  ordine integer NOT NULL,
  produs_id uuid REFERENCES public.produse_fitosanitare(id) ON DELETE RESTRICT,
  produs_nume_manual text,
  produs_nume_snapshot text NOT NULL,
  substanta_activa_snapshot text,
  tip_snapshot text
    CHECK (
      tip_snapshot IS NULL
      OR tip_snapshot IN (
        'fungicid',
        'insecticid',
        'erbicid',
        'acaricid',
        'foliar',
        'ingrasamant',
        'bioregulator',
        'altul'
      )
    ),
  frac_irac_snapshot text,
  phi_zile_snapshot integer
    CHECK (phi_zile_snapshot IS NULL OR phi_zile_snapshot >= 0),
  doza_ml_per_hl numeric
    CHECK (doza_ml_per_hl IS NULL OR doza_ml_per_hl >= 0),
  doza_l_per_ha numeric
    CHECK (doza_l_per_ha IS NULL OR doza_l_per_ha >= 0),
  observatii text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plan_linie_produse_ordine_check
    CHECK (ordine >= 1),
  CONSTRAINT plan_linie_produse_produs_xor_check
    CHECK (
      (
        produs_id IS NOT NULL
        AND NULLIF(BTRIM(produs_nume_manual), '') IS NULL
      )
      OR (
        produs_id IS NULL
        AND NULLIF(BTRIM(produs_nume_manual), '') IS NOT NULL
      )
    ),
  CONSTRAINT plan_linie_produse_plan_ordine_key
    UNIQUE (plan_linie_id, ordine)
);

CREATE TABLE IF NOT EXISTS public.aplicari_tratament_produse (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  aplicare_id uuid NOT NULL REFERENCES public.aplicari_tratament(id) ON DELETE CASCADE,
  plan_linie_produs_id uuid REFERENCES public.planuri_tratament_linie_produse(id) ON DELETE SET NULL,
  ordine integer NOT NULL,
  produs_id uuid REFERENCES public.produse_fitosanitare(id) ON DELETE RESTRICT,
  produs_nume_manual text,
  produs_nume_snapshot text NOT NULL,
  substanta_activa_snapshot text,
  tip_snapshot text
    CHECK (
      tip_snapshot IS NULL
      OR tip_snapshot IN (
        'fungicid',
        'insecticid',
        'erbicid',
        'acaricid',
        'foliar',
        'ingrasamant',
        'bioregulator',
        'altul'
      )
    ),
  frac_irac_snapshot text,
  phi_zile_snapshot integer
    CHECK (phi_zile_snapshot IS NULL OR phi_zile_snapshot >= 0),
  doza_ml_per_hl numeric
    CHECK (doza_ml_per_hl IS NULL OR doza_ml_per_hl >= 0),
  doza_l_per_ha numeric
    CHECK (doza_l_per_ha IS NULL OR doza_l_per_ha >= 0),
  cantitate_totala numeric
    CHECK (cantitate_totala IS NULL OR cantitate_totala >= 0),
  unitate_cantitate text
    CHECK (
      unitate_cantitate IS NULL
      OR unitate_cantitate IN ('ml', 'l', 'g', 'kg', 'buc', 'altul')
    ),
  stoc_mutatie_id uuid REFERENCES public.miscari_stoc(id) ON DELETE SET NULL,
  observatii text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT aplicare_produse_ordine_check
    CHECK (ordine >= 1),
  CONSTRAINT aplicare_produse_produs_xor_check
    CHECK (
      (
        produs_id IS NOT NULL
        AND NULLIF(BTRIM(produs_nume_manual), '') IS NULL
      )
      OR (
        produs_id IS NULL
        AND NULLIF(BTRIM(produs_nume_manual), '') IS NOT NULL
      )
    ),
  CONSTRAINT aplicare_produse_aplicare_ordine_key
    UNIQUE (aplicare_id, ordine)
);

ALTER TABLE public.planuri_tratament_linie_produse ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aplicari_tratament_produse ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS planuri_tratament_linie_produse_select ON public.planuri_tratament_linie_produse;
CREATE POLICY planuri_tratament_linie_produse_select
  ON public.planuri_tratament_linie_produse
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS planuri_tratament_linie_produse_insert ON public.planuri_tratament_linie_produse;
CREATE POLICY planuri_tratament_linie_produse_insert
  ON public.planuri_tratament_linie_produse
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND EXISTS (
      SELECT 1
      FROM public.planuri_tratament_linii linie
      WHERE linie.id = plan_linie_id
        AND linie.tenant_id = public.current_tenant_id()
    )
    AND (
      produs_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.produse_fitosanitare produs
        WHERE produs.id = produs_id
          AND (produs.tenant_id IS NULL OR produs.tenant_id = public.current_tenant_id())
      )
    )
  );

DROP POLICY IF EXISTS planuri_tratament_linie_produse_update ON public.planuri_tratament_linie_produse;
CREATE POLICY planuri_tratament_linie_produse_update
  ON public.planuri_tratament_linie_produse
  FOR UPDATE
  TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND EXISTS (
      SELECT 1
      FROM public.planuri_tratament_linii linie
      WHERE linie.id = plan_linie_id
        AND linie.tenant_id = public.current_tenant_id()
    )
    AND (
      produs_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.produse_fitosanitare produs
        WHERE produs.id = produs_id
          AND (produs.tenant_id IS NULL OR produs.tenant_id = public.current_tenant_id())
      )
    )
  );

DROP POLICY IF EXISTS planuri_tratament_linie_produse_delete ON public.planuri_tratament_linie_produse;
CREATE POLICY planuri_tratament_linie_produse_delete
  ON public.planuri_tratament_linie_produse
  FOR DELETE
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS aplicari_tratament_produse_select ON public.aplicari_tratament_produse;
CREATE POLICY aplicari_tratament_produse_select
  ON public.aplicari_tratament_produse
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS aplicari_tratament_produse_insert ON public.aplicari_tratament_produse;
CREATE POLICY aplicari_tratament_produse_insert
  ON public.aplicari_tratament_produse
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND EXISTS (
      SELECT 1
      FROM public.aplicari_tratament aplicare
      WHERE aplicare.id = aplicare_id
        AND aplicare.tenant_id = public.current_tenant_id()
    )
    AND (
      plan_linie_produs_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.planuri_tratament_linie_produse plan_produs
        WHERE plan_produs.id = plan_linie_produs_id
          AND plan_produs.tenant_id = public.current_tenant_id()
      )
    )
    AND (
      produs_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.produse_fitosanitare produs
        WHERE produs.id = produs_id
          AND (produs.tenant_id IS NULL OR produs.tenant_id = public.current_tenant_id())
      )
    )
  );

DROP POLICY IF EXISTS aplicari_tratament_produse_update ON public.aplicari_tratament_produse;
CREATE POLICY aplicari_tratament_produse_update
  ON public.aplicari_tratament_produse
  FOR UPDATE
  TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND EXISTS (
      SELECT 1
      FROM public.aplicari_tratament aplicare
      WHERE aplicare.id = aplicare_id
        AND aplicare.tenant_id = public.current_tenant_id()
    )
    AND (
      plan_linie_produs_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.planuri_tratament_linie_produse plan_produs
        WHERE plan_produs.id = plan_linie_produs_id
          AND plan_produs.tenant_id = public.current_tenant_id()
      )
    )
    AND (
      produs_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.produse_fitosanitare produs
        WHERE produs.id = produs_id
          AND (produs.tenant_id IS NULL OR produs.tenant_id = public.current_tenant_id())
      )
    )
  );

DROP POLICY IF EXISTS aplicari_tratament_produse_delete ON public.aplicari_tratament_produse;
CREATE POLICY aplicari_tratament_produse_delete
  ON public.aplicari_tratament_produse
  FOR DELETE
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE INDEX IF NOT EXISTS idx_plan_linie_produse_tenant_id
  ON public.planuri_tratament_linie_produse(tenant_id);

CREATE INDEX IF NOT EXISTS idx_plan_linie_produse_produs_id
  ON public.planuri_tratament_linie_produse(produs_id)
  WHERE produs_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_aplicare_produse_tenant_id
  ON public.aplicari_tratament_produse(tenant_id);

CREATE INDEX IF NOT EXISTS idx_aplicare_produse_plan_linie_produs
  ON public.aplicari_tratament_produse(plan_linie_produs_id)
  WHERE plan_linie_produs_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_aplicare_produse_produs_id
  ON public.aplicari_tratament_produse(produs_id)
  WHERE produs_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_aplicari_tratament_tenant_status_planificata
  ON public.aplicari_tratament(tenant_id, status, data_planificata);

CREATE INDEX IF NOT EXISTS idx_aplicari_tratament_tenant_parcela_status_plan
  ON public.aplicari_tratament(tenant_id, parcela_id, status, data_planificata DESC);

CREATE INDEX IF NOT EXISTS idx_aplicari_tratament_tenant_parcela_data_aplicata
  ON public.aplicari_tratament(tenant_id, parcela_id, data_aplicata DESC)
  WHERE data_aplicata IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_aplicari_tratament_stadiu_fenologic
  ON public.aplicari_tratament(stadiu_fenologic_id)
  WHERE stadiu_fenologic_id IS NOT NULL;

DROP TRIGGER IF EXISTS planuri_tratament_linie_produse_touch_updated_at ON public.planuri_tratament_linie_produse;
CREATE TRIGGER planuri_tratament_linie_produse_touch_updated_at
  BEFORE UPDATE ON public.planuri_tratament_linie_produse
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS aplicari_tratament_produse_touch_updated_at ON public.aplicari_tratament_produse;
CREATE TRIGGER aplicari_tratament_produse_touch_updated_at
  BEFORE UPDATE ON public.aplicari_tratament_produse
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

-- Backfill V1: fiecare linie cu produs legacy devine interventie cu un produs copil.
INSERT INTO public.planuri_tratament_linie_produse (
  tenant_id,
  plan_linie_id,
  ordine,
  produs_id,
  produs_nume_manual,
  produs_nume_snapshot,
  substanta_activa_snapshot,
  tip_snapshot,
  frac_irac_snapshot,
  phi_zile_snapshot,
  doza_ml_per_hl,
  doza_l_per_ha,
  observatii,
  created_at,
  updated_at
)
SELECT
  linie.tenant_id,
  linie.id,
  1,
  linie.produs_id,
  linie.produs_nume_manual,
  COALESCE(produs.nume_comercial, linie.produs_nume_manual),
  produs.substanta_activa,
  produs.tip,
  produs.frac_irac,
  produs.phi_zile,
  linie.doza_ml_per_hl,
  linie.doza_l_per_ha,
  linie.observatii,
  linie.created_at,
  linie.updated_at
FROM public.planuri_tratament_linii linie
LEFT JOIN public.produse_fitosanitare produs
  ON produs.id = linie.produs_id
WHERE (
    linie.produs_id IS NOT NULL
    OR NULLIF(BTRIM(linie.produs_nume_manual), '') IS NOT NULL
  )
  AND COALESCE(produs.nume_comercial, linie.produs_nume_manual) IS NOT NULL
ON CONFLICT (plan_linie_id, ordine) DO NOTHING;

-- Backfill V1: fiecare aplicare cu produs legacy primeste produs efectiv copil.
INSERT INTO public.aplicari_tratament_produse (
  tenant_id,
  aplicare_id,
  plan_linie_produs_id,
  ordine,
  produs_id,
  produs_nume_manual,
  produs_nume_snapshot,
  substanta_activa_snapshot,
  tip_snapshot,
  frac_irac_snapshot,
  phi_zile_snapshot,
  doza_ml_per_hl,
  doza_l_per_ha,
  cantitate_totala,
  unitate_cantitate,
  stoc_mutatie_id,
  observatii,
  created_at,
  updated_at
)
SELECT
  aplicare.tenant_id,
  aplicare.id,
  plan_produs.id,
  1,
  aplicare.produs_id,
  aplicare.produs_nume_manual,
  COALESCE(produs.nume_comercial, aplicare.produs_nume_manual, plan_produs.produs_nume_snapshot),
  COALESCE(produs.substanta_activa, plan_produs.substanta_activa_snapshot),
  COALESCE(produs.tip, plan_produs.tip_snapshot),
  COALESCE(produs.frac_irac, plan_produs.frac_irac_snapshot),
  COALESCE(produs.phi_zile, plan_produs.phi_zile_snapshot),
  aplicare.doza_ml_per_hl,
  aplicare.doza_l_per_ha,
  aplicare.cantitate_totala_ml,
  CASE
    WHEN aplicare.cantitate_totala_ml IS NOT NULL THEN 'ml'
    ELSE NULL
  END,
  aplicare.stoc_mutatie_id,
  aplicare.observatii,
  aplicare.created_at,
  aplicare.updated_at
FROM public.aplicari_tratament aplicare
LEFT JOIN public.produse_fitosanitare produs
  ON produs.id = aplicare.produs_id
LEFT JOIN public.planuri_tratament_linie_produse plan_produs
  ON plan_produs.plan_linie_id = aplicare.plan_linie_id
 AND plan_produs.ordine = 1
WHERE (
    aplicare.produs_id IS NOT NULL
    OR NULLIF(BTRIM(aplicare.produs_nume_manual), '') IS NOT NULL
  )
  AND COALESCE(produs.nume_comercial, aplicare.produs_nume_manual, plan_produs.produs_nume_snapshot) IS NOT NULL
ON CONFLICT (aplicare_id, ordine) DO NOTHING;

COMMENT ON TABLE public.planuri_tratament_linie_produse IS
  'V2 Tratamente: produsele planificate pentru o interventie din planuri_tratament_linii.';

COMMENT ON TABLE public.aplicari_tratament_produse IS
  'V2 Tratamente: produsele efectiv folosite intr-o aplicare, cu snapshot pentru istoric.';

COMMENT ON COLUMN public.planuri_tratament_linii.tip_interventie IS
  'V2: tip semantic al interventiei planificate; linia nu mai reprezinta un singur produs.';

COMMENT ON COLUMN public.aplicari_tratament.sursa IS
  'V2: din_plan pentru aplicari generate din interventii, manuala pentru interventii ad-hoc.';

NOTIFY pgrst, 'reload schema';
