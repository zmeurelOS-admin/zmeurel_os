-- DEPRECATED: Duplicat idempotent al 2026031401_add_demo_fields_to_tenants.sql (format A)
-- Add is_demo and expires_at columns to tenants for demo lifecycle management
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Index for fast cleanup queries
CREATE INDEX IF NOT EXISTS idx_tenants_demo_expires ON public.tenants (is_demo, expires_at)
  WHERE is_demo = true;

-- Mark existing demo tenants (by email pattern via owner join)
UPDATE public.tenants t
SET
  is_demo    = true,
  expires_at = t.created_at + INTERVAL '48 hours'
FROM auth.users u
WHERE u.id = t.owner_user_id
  AND u.email LIKE '%@demo.zmeurel.local'
  AND t.is_demo = false;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
