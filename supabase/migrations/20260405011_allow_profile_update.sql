DROP POLICY IF EXISTS tenants_update_association_admin ON public.tenants;
DROP POLICY IF EXISTS association_staff_update_tenant_profile ON public.tenants;

CREATE POLICY association_staff_update_tenant_profile
  ON public.tenants
  FOR UPDATE
  USING (
    is_association_approved = true
    AND EXISTS (
      SELECT 1
      FROM public.association_members am
      WHERE am.user_id = auth.uid()
        AND am.role IN ('admin', 'moderator')
    )
  )
  WITH CHECK (
    is_association_approved = true
    AND EXISTS (
      SELECT 1
      FROM public.association_members am
      WHERE am.user_id = auth.uid()
        AND am.role IN ('admin', 'moderator')
    )
  );

CREATE OR REPLACE FUNCTION public.enforce_tenants_assoc_admin_updates()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  is_assoc_staff boolean := false;
BEGIN
  IF NEW.owner_user_id IS NOT DISTINCT FROM auth.uid() THEN
    RETURN NEW;
  END IF;

  IF public.is_superadmin() THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.association_members am
    WHERE am.user_id = auth.uid()
      AND am.role IN ('admin', 'moderator')
  )
  INTO is_assoc_staff;

  IF NOT is_assoc_staff THEN
    RETURN NEW;
  END IF;

  IF (
    OLD.id IS DISTINCT FROM NEW.id
    OR OLD.nume_ferma IS DISTINCT FROM NEW.nume_ferma
    OR OLD.owner_user_id IS DISTINCT FROM NEW.owner_user_id
    OR OLD.plan IS DISTINCT FROM NEW.plan
    OR OLD.contact_phone IS DISTINCT FROM NEW.contact_phone
    OR OLD.is_demo IS DISTINCT FROM NEW.is_demo
    OR OLD.demo_seed_id IS DISTINCT FROM NEW.demo_seed_id
    OR OLD.demo_seeded IS DISTINCT FROM NEW.demo_seeded
    OR OLD.demo_seeded_at IS DISTINCT FROM NEW.demo_seeded_at
    OR OLD.expires_at IS DISTINCT FROM NEW.expires_at
    OR OLD.onboarding_shown_at IS DISTINCT FROM NEW.onboarding_shown_at
    OR OLD.exclude_from_analytics IS DISTINCT FROM NEW.exclude_from_analytics
    OR OLD.created_at IS DISTINCT FROM NEW.created_at
    OR OLD.is_association_approved IS DISTINCT FROM NEW.is_association_approved
  ) THEN
    RAISE EXCEPTION 'Association staff can only update public profile fields.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tenants_assoc_admin_field_guard ON public.tenants;
CREATE TRIGGER tenants_assoc_admin_field_guard
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_tenants_assoc_admin_updates();

NOTIFY pgrst, 'reload schema';
