-- Demo seed parity: produse table lacked data_origin / demo_seed_id (added after other tenant tables).

ALTER TABLE public.produse ADD COLUMN IF NOT EXISTS data_origin text;
ALTER TABLE public.produse ADD COLUMN IF NOT EXISTS demo_seed_id uuid;

CREATE INDEX IF NOT EXISTS idx_produse_tenant_demo_seed
  ON public.produse (tenant_id, demo_seed_id);
