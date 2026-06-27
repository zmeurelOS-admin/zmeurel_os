
-- Backfills migrations 20260616174748 + 20260616174905 from main branch
ALTER TABLE public.clienti
  ADD COLUMN IF NOT EXISTS tip text NOT NULL DEFAULT 'standard';
;
