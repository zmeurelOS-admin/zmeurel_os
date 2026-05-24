CREATE TABLE public.planuri_template (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cod text NOT NULL UNIQUE,
  nume text NOT NULL,
  cultura_tip text NOT NULL,
  cohort text CHECK (cohort IS NULL OR cohort IN ('floricane', 'primocane')),
  descriere text,
  durata_sezon_estimata text,
  nr_interventii integer NOT NULL DEFAULT 0,
  activ boolean NOT NULL DEFAULT true,
  ordine integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.planuri_template_linii (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.planuri_template(id) ON DELETE CASCADE,
  ordine integer NOT NULL,
  stadiu_trigger text NOT NULL,
  cohort_trigger text CHECK (cohort_trigger IS NULL OR cohort_trigger IN ('floricane', 'primocane')),
  tip_interventie text CHECK (tip_interventie IS NULL OR tip_interventie IN (
    'protectie', 'nutritie', 'biostimulare', 'erbicidare', 'igiena', 'monitorizare', 'altul'
  )),
  metoda_aplicare text CHECK (metoda_aplicare IS NULL OR metoda_aplicare IN (
    'foliar', 'fertirigare', 'fertilizare_baza', 'granulat_sol', 'capcana_pus', 'capcana_verificat', 'altul'
  )),
  scop text NOT NULL,
  regula_repetare text NOT NULL DEFAULT 'fara_repetare' CHECK (regula_repetare IN ('fara_repetare', 'interval')),
  interval_repetare_zile integer,
  numar_repetari_max integer,
  fereastra_start_offset_zile integer,
  fereastra_end_offset_zile integer,
  produs_sugerat_nume text,
  produs_sugerat_substanta text,
  produs_sugerat_doza_text text,
  observatii text
);

CREATE INDEX idx_planuri_template_linii_template
  ON public.planuri_template_linii(template_id, ordine);

ALTER TABLE public.planuri_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planuri_template_linii ENABLE ROW LEVEL SECURITY;

CREATE POLICY planuri_template_select ON public.planuri_template
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY planuri_template_linii_select ON public.planuri_template_linii
  FOR SELECT USING (auth.role() = 'authenticated');
