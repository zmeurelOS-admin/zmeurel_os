-- Add phone column to profiles for per-user phone (separate from tenants.contact_phone)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS phone text NULL;

-- Allow users to update their own phone
-- (profiles RLS already allows users to update their own row)

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
