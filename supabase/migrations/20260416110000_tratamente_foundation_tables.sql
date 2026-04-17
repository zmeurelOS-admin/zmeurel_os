CREATE TABLE IF NOT EXISTS public.produse_fitosanitare (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  nume_comercial text NOT NULL,
  substanta_activa text NOT NULL,
  tip text NOT NULL
    CHECK (
      tip IN (
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
  frac_irac text,
  doza_min_ml_per_hl numeric
    CHECK (doza_min_ml_per_hl IS NULL OR doza_min_ml_per_hl >= 0),
  doza_max_ml_per_hl numeric
    CHECK (doza_max_ml_per_hl IS NULL OR doza_max_ml_per_hl >= 0),
  doza_min_l_per_ha numeric
    CHECK (doza_min_l_per_ha IS NULL OR doza_min_l_per_ha >= 0),
  doza_max_l_per_ha numeric
    CHECK (doza_max_l_per_ha IS NULL OR doza_max_l_per_ha >= 0),
  phi_zile integer
    CHECK (phi_zile IS NULL OR phi_zile >= 0),
  nr_max_aplicari_per_sezon integer
    CHECK (nr_max_aplicari_per_sezon IS NULL OR nr_max_aplicari_per_sezon >= 0),
  interval_min_aplicari_zile integer
    CHECK (interval_min_aplicari_zile IS NULL OR interval_min_aplicari_zile >= 0),
  omologat_culturi text[],
  activ boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  CONSTRAINT produse_fitosanitare_scope_name_key
    UNIQUE NULLS NOT DISTINCT (tenant_id, nume_comercial)
);

CREATE TABLE IF NOT EXISTS public.planuri_tratament (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nume text NOT NULL,
  cultura_tip text NOT NULL,
  descriere text,
  activ boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.planuri_tratament_linii (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.planuri_tratament(id) ON DELETE CASCADE,
  ordine integer NOT NULL,
  stadiu_trigger text NOT NULL,
  produs_id uuid REFERENCES public.produse_fitosanitare(id) ON DELETE RESTRICT,
  produs_nume_manual text,
  doza_ml_per_hl numeric
    CHECK (doza_ml_per_hl IS NULL OR doza_ml_per_hl >= 0),
  doza_l_per_ha numeric
    CHECK (doza_l_per_ha IS NULL OR doza_l_per_ha >= 0),
  observatii text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT planuri_tratament_linii_produs_xor_check
    CHECK (
      (
        produs_id IS NOT NULL
        AND NULLIF(BTRIM(produs_nume_manual), '') IS NULL
      )
      OR (
        produs_id IS NULL
        AND NULLIF(BTRIM(produs_nume_manual), '') IS NOT NULL
      )
    )
);

CREATE TABLE IF NOT EXISTS public.parcele_planuri (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  parcela_id uuid NOT NULL REFERENCES public.parcele(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.planuri_tratament(id) ON DELETE RESTRICT,
  an integer NOT NULL,
  activ boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stadii_fenologice_parcela (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  parcela_id uuid NOT NULL REFERENCES public.parcele(id) ON DELETE CASCADE,
  an integer NOT NULL,
  stadiu text NOT NULL,
  data_observata date NOT NULL,
  sursa text NOT NULL
    CHECK (sursa IN ('manual', 'gdd', 'poza', 'auto')),
  observatii text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  CONSTRAINT stadii_fenologice_parcela_unique
    UNIQUE (parcela_id, an, stadiu, sursa)
);

CREATE TABLE IF NOT EXISTS public.aplicari_tratament (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  parcela_id uuid NOT NULL REFERENCES public.parcele(id) ON DELETE RESTRICT,
  cultura_id uuid REFERENCES public.culturi(id) ON DELETE SET NULL,
  plan_linie_id uuid REFERENCES public.planuri_tratament_linii(id) ON DELETE SET NULL,
  produs_id uuid REFERENCES public.produse_fitosanitare(id) ON DELETE RESTRICT,
  produs_nume_manual text,
  data_planificata date,
  data_aplicata timestamptz,
  doza_ml_per_hl numeric
    CHECK (doza_ml_per_hl IS NULL OR doza_ml_per_hl >= 0),
  doza_l_per_ha numeric
    CHECK (doza_l_per_ha IS NULL OR doza_l_per_ha >= 0),
  cantitate_totala_ml numeric
    CHECK (cantitate_totala_ml IS NULL OR cantitate_totala_ml >= 0),
  stoc_mutatie_id uuid REFERENCES public.miscari_stoc(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'planificata'
    CHECK (status IN ('planificata', 'aplicata', 'reprogramata', 'anulata', 'omisa')),
  meteo_snapshot jsonb,
  stadiu_la_aplicare text,
  observatii text,
  operator text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  CONSTRAINT aplicari_tratament_produs_xor_check
    CHECK (
      (
        produs_id IS NOT NULL
        AND NULLIF(BTRIM(produs_nume_manual), '') IS NULL
      )
      OR (
        produs_id IS NULL
        AND NULLIF(BTRIM(produs_nume_manual), '') IS NOT NULL
      )
    )
);
