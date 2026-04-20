-- 1. Adaugă coloana dacă nu există
ALTER TABLE activitati_agricole
  ADD COLUMN IF NOT EXISTS tip_deprecat boolean NOT NULL DEFAULT false;

-- 2. Marchează ca deprecate toate înregistrările cu tipuri P&N
UPDATE activitati_agricole
SET tip_deprecat = true
WHERE lower(trim(tip_activitate)) IN (
  'fungicide/pesticide',
  'fertilizare foliară',
  'fertilizare foliara',
  'fertilizare foliar',
  'fertirigare',
  'fertigare',
  'fertilizare de bază',
  'fertilizare de baza',
  'fertilizare',
  'fertilizare chimica',
  'fertilizare organica',
  'tratament',
  'tratament fitosanitar',
  'tratament fungicid',
  'tratament insecticid',
  'tratament erbicid',
  'erbicidat',
  'stropire'
);

-- 3. Adaugă index pentru queries care filtrează după tip_deprecat
CREATE INDEX IF NOT EXISTS idx_activitati_tip_deprecat
  ON activitati_agricole(tenant_id, tip_deprecat);
