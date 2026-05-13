ALTER TABLE public.aplicari_tratament
  DROP CONSTRAINT IF EXISTS aplicari_tratament_status_check;

ALTER TABLE public.aplicari_tratament
  ADD CONSTRAINT aplicari_tratament_status_check
  CHECK (status IN (
    'planificata',
    'aplicata',
    'reprogramata',
    'anulata',
    'omisa',
    'ciorna'
  ));
