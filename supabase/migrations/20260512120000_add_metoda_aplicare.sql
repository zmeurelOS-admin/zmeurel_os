ALTER TABLE public.aplicari_tratament
  ADD COLUMN IF NOT EXISTS metoda_aplicare text
  CHECK (metoda_aplicare IS NULL OR metoda_aplicare IN (
    'foliar',
    'fertirigare',
    'fertilizare_baza',
    'granulat_sol',
    'capcana_pus',
    'capcana_verificat',
    'altul'
  ));

CREATE INDEX IF NOT EXISTS idx_aplicari_tratament_metoda
  ON public.aplicari_tratament(metoda_aplicare);

ALTER TABLE public.planuri_tratament_linii
  ADD COLUMN IF NOT EXISTS metoda_aplicare text
  CHECK (metoda_aplicare IS NULL OR metoda_aplicare IN (
    'foliar',
    'fertirigare',
    'fertilizare_baza',
    'granulat_sol',
    'capcana_pus',
    'capcana_verificat',
    'altul'
  ));

CREATE INDEX IF NOT EXISTS idx_planuri_linii_metoda
  ON public.planuri_tratament_linii(metoda_aplicare);

COMMENT ON COLUMN public.aplicari_tratament.metoda_aplicare IS
  'Metoda fizică de aplicare. Ortogonal cu tip_interventie (scop agronomic). NULL = vechi import Excel V3.';

COMMENT ON COLUMN public.planuri_tratament_linii.metoda_aplicare IS
  'Metoda fizică planificată de aplicare. Ortogonal cu tip_interventie (scop agronomic). NULL = vechi import Excel V3.';
