-- Câmpuri opționale pentru informații alimentare (etichetare / vitrina publică)
ALTER TABLE produse ADD COLUMN IF NOT EXISTS ingrediente text;
ALTER TABLE produse ADD COLUMN IF NOT EXISTS alergeni text;
ALTER TABLE produse ADD COLUMN IF NOT EXISTS conditii_pastrare text;
ALTER TABLE produse ADD COLUMN IF NOT EXISTS termen_valabilitate text;
ALTER TABLE produse ADD COLUMN IF NOT EXISTS tip_produs text DEFAULT 'standard'
  CHECK (tip_produs IN ('standard', 'proaspat', 'procesat'));

COMMENT ON COLUMN produse.ingrediente IS 'Opțional — listă ingrediente (magazin public)';
COMMENT ON COLUMN produse.alergeni IS 'Opțional — alergeni (afișare evidențiată în UI)';
COMMENT ON COLUMN produse.conditii_pastrare IS 'Opțional — păstrare';
COMMENT ON COLUMN produse.termen_valabilitate IS 'Opțional — valabilitate / consum preferințial';
COMMENT ON COLUMN produse.tip_produs IS 'Clasificare simplă pentru UX';
