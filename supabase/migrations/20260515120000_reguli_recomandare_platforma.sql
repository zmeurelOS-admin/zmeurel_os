CREATE TABLE public.reguli_recomandare_platforma (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cod text NOT NULL UNIQUE,
  cultura_tip text NOT NULL,
  fenofaza text NOT NULL,
  metoda_aplicare text NOT NULL CHECK (metoda_aplicare IN (
    'foliar',
    'fertirigare',
    'fertilizare_baza',
    'granulat_sol',
    'capcana_pus',
    'capcana_verificat',
    'altul'
  )),
  cohort text CHECK (cohort IS NULL OR cohort IN ('floricane', 'primocane')),
  luni_active integer[],
  titlu text NOT NULL,
  descriere text,
  produs_sugerat_nume text,
  produs_sugerat_doza_text text,
  tip_interventie text CHECK (tip_interventie IS NULL OR tip_interventie IN (
    'protectie',
    'nutritie',
    'biostimulare',
    'erbicidare',
    'igiena',
    'monitorizare',
    'altul'
  )),
  prioritate integer NOT NULL DEFAULT 50,
  activ boolean NOT NULL DEFAULT true,
  sursa text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reguli_trigger ON public.reguli_recomandare_platforma(
  cultura_tip,
  fenofaza,
  metoda_aplicare
) WHERE activ = true;

ALTER TABLE public.reguli_recomandare_platforma ENABLE ROW LEVEL SECURITY;

CREATE POLICY reguli_recomandare_select ON public.reguli_recomandare_platforma
  FOR SELECT USING (auth.role() = 'authenticated');

COMMENT ON TABLE public.reguli_recomandare_platforma IS
  'Reguli globale de recomandare pentru fallback când plan activ lipsește sau e insuficient. Citibile de oricine autentificat. Management direct prin Supabase SQL/dashboard (admin).';
