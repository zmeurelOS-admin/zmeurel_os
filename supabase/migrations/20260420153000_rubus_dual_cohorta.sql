ALTER TABLE public.stadii_fenologice_parcela
  ADD COLUMN IF NOT EXISTS cohort text;

ALTER TABLE public.planuri_tratament_linii
  ADD COLUMN IF NOT EXISTS cohort_trigger text;

ALTER TABLE public.aplicari_tratament
  ADD COLUMN IF NOT EXISTS cohort_la_aplicare text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'stadii_fenologice_parcela_cohort_check'
      AND conrelid = 'public.stadii_fenologice_parcela'::regclass
  ) THEN
    ALTER TABLE public.stadii_fenologice_parcela
      ADD CONSTRAINT stadii_fenologice_parcela_cohort_check
      CHECK (cohort IS NULL OR cohort IN ('floricane', 'primocane'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'planuri_tratament_linii_cohort_trigger_check'
      AND conrelid = 'public.planuri_tratament_linii'::regclass
  ) THEN
    ALTER TABLE public.planuri_tratament_linii
      ADD CONSTRAINT planuri_tratament_linii_cohort_trigger_check
      CHECK (cohort_trigger IS NULL OR cohort_trigger IN ('floricane', 'primocane'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'aplicari_tratament_cohort_la_aplicare_check'
      AND conrelid = 'public.aplicari_tratament'::regclass
  ) THEN
    ALTER TABLE public.aplicari_tratament
      ADD CONSTRAINT aplicari_tratament_cohort_la_aplicare_check
      CHECK (cohort_la_aplicare IS NULL OR cohort_la_aplicare IN ('floricane', 'primocane'));
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'stadii_fenologice_parcela_unique'
      AND conrelid = 'public.stadii_fenologice_parcela'::regclass
      AND pg_get_constraintdef(oid) NOT LIKE 'UNIQUE NULLS NOT DISTINCT (parcela_id, an, stadiu, sursa, cohort)%'
  ) THEN
    ALTER TABLE public.stadii_fenologice_parcela
      DROP CONSTRAINT stadii_fenologice_parcela_unique;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'stadii_fenologice_parcela_unique'
      AND conrelid = 'public.stadii_fenologice_parcela'::regclass
  ) THEN
    ALTER TABLE public.stadii_fenologice_parcela
      ADD CONSTRAINT stadii_fenologice_parcela_unique
      UNIQUE NULLS NOT DISTINCT (parcela_id, an, stadiu, sursa, cohort);
  END IF;
END
$$;
