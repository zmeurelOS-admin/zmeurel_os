ALTER TABLE public.planuri_tratament_linii
  ADD COLUMN IF NOT EXISTS sursa_linie text NOT NULL DEFAULT 'din_plan',
  ADD COLUMN IF NOT EXISTS motiv_adaugare text NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'check_sursa_linie'
      AND conrelid = 'public.planuri_tratament_linii'::regclass
  ) THEN
    ALTER TABLE public.planuri_tratament_linii
      ADD CONSTRAINT check_sursa_linie
      CHECK (sursa_linie IN ('din_plan', 'adaugata_manual'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'check_motiv_adaugare'
      AND conrelid = 'public.planuri_tratament_linii'::regclass
  ) THEN
    ALTER TABLE public.planuri_tratament_linii
      ADD CONSTRAINT check_motiv_adaugare
      CHECK (motiv_adaugare IS NULL OR length(trim(motiv_adaugare)) > 0);
  END IF;
END
$$;

COMMENT ON COLUMN public.planuri_tratament_linii.sursa_linie IS
  'din_plan = rând original din import/setup; adaugata_manual = adăugat ulterior de fermier';

COMMENT ON COLUMN public.planuri_tratament_linii.motiv_adaugare IS
  'Motiv text liber pentru intervenții adăugate manual (carentă, dăunători etc.)';
