-- Add contact_phone and onboarding_shown_at to tenants table
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS contact_phone text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS onboarding_shown_at timestamptz;
