-- Fix defaults/backfill for parcele fields used by edit form and dashboard relevance.
-- Uses real column names from runtime schema: rol, apare_in_dashboard,
-- contribuie_la_productie, status_operational, latitudine, longitudine.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'parcele'
      AND column_name = 'rol'
  ) THEN
    ALTER TABLE public.parcele ALTER COLUMN rol SET DEFAULT 'comercial';
    UPDATE public.parcele SET rol = 'comercial' WHERE rol IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'parcele'
      AND column_name = 'apare_in_dashboard'
  ) THEN
    ALTER TABLE public.parcele ALTER COLUMN apare_in_dashboard SET DEFAULT true;
    UPDATE public.parcele SET apare_in_dashboard = true WHERE apare_in_dashboard IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'parcele'
      AND column_name = 'contribuie_la_productie'
  ) THEN
    ALTER TABLE public.parcele ALTER COLUMN contribuie_la_productie SET DEFAULT true;
    UPDATE public.parcele SET contribuie_la_productie = true WHERE contribuie_la_productie IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'parcele'
      AND column_name = 'status_operational'
  ) THEN
    ALTER TABLE public.parcele ALTER COLUMN status_operational SET DEFAULT 'activ';
    UPDATE public.parcele SET status_operational = 'activ' WHERE status_operational IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'parcele'
      AND column_name = 'latitudine'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.parcele ALTER COLUMN latitudine DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'parcele'
      AND column_name = 'longitudine'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.parcele ALTER COLUMN longitudine DROP NOT NULL;
  END IF;
END $$;

notify pgrst, 'reload schema';
