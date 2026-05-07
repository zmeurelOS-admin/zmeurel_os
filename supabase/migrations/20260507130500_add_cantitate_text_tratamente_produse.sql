ALTER TABLE public.aplicari_tratament_produse
  ADD COLUMN IF NOT EXISTS cantitate_text TEXT;

ALTER TABLE public.planuri_tratament_linie_produse
  ADD COLUMN IF NOT EXISTS cantitate_text TEXT;
