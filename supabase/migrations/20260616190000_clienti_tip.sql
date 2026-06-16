ALTER TABLE public.clienti
  ADD COLUMN IF NOT EXISTS tip text NOT NULL DEFAULT 'standard'
  CHECK (tip IN ('standard', 'patiserie', 'magazin'));

COMMENT ON COLUMN public.clienti.tip IS
  'Tipul clientului: standard (persoana fizica), patiserie, magazin (B2B)';

NOTIFY pgrst, 'reload schema';
