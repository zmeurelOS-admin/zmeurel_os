ALTER TABLE public.planuri_tratament
ADD COLUMN IF NOT EXISTS arhivat boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_planuri_tratament_tenant_arhivat
  ON public.planuri_tratament(tenant_id, arhivat);
