-- Număr scurt pentru comenzile din magazinul asociației.
-- Notă: nu facem backfill pe date existente din proiectul conectat; evităm UPDATE pe tabele cu date reale.

CREATE SEQUENCE IF NOT EXISTS public.seq_association_order_number START WITH 100;

ALTER TABLE public.comenzi
  ADD COLUMN IF NOT EXISTS numar_comanda_scurt text;

COMMENT ON COLUMN public.comenzi.numar_comanda_scurt IS 'Număr scurt pentru comenzile din magazinul asociației, format NR/DD.MM.YYYY.';

CREATE OR REPLACE FUNCTION public.generate_short_order_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.data_origin = 'magazin_asociatie' AND NEW.numar_comanda_scurt IS NULL THEN
    NEW.numar_comanda_scurt :=
      nextval('public.seq_association_order_number')::text || '/' ||
      to_char(COALESCE(NEW.data_comanda, (now() AT TIME ZONE 'Europe/Bucharest')::date), 'DD.MM.YYYY');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_short_order_number ON public.comenzi;

CREATE TRIGGER trg_short_order_number
  BEFORE INSERT ON public.comenzi
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_short_order_number();
