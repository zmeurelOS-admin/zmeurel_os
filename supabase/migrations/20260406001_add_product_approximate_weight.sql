-- Add optional approximate weight label for association/public products.
-- This is presentation-only metadata and does not affect order quantities.

ALTER TABLE public.produse
  ADD COLUMN IF NOT EXISTS approximate_weight text;

COMMENT ON COLUMN public.produse.approximate_weight IS
  'Optional approximate weight label for unit-based products, e.g. ~300g or ~500g.';

NOTIFY pgrst, 'reload schema';
