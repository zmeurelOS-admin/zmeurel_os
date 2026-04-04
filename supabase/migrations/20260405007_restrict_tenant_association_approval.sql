-- Doar superadminul poate modifica tenants.is_association_approved.
-- Adminul asociației nu mai are UPDATE pe tenants (doar superadmin + owner, ca înainte).

DROP POLICY IF EXISTS tenants_update_association_admin ON public.tenants;

DROP TRIGGER IF EXISTS tenants_assoc_admin_field_guard ON public.tenants;
DROP FUNCTION IF EXISTS public.enforce_tenants_assoc_admin_updates();

-- Orice schimbare a coloanei is_association_approved: doar superadmin (auth.uid()).
CREATE OR REPLACE FUNCTION public.enforce_tenant_association_approval_superadmin_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.is_association_approved IS NOT DISTINCT FROM NEW.is_association_approved THEN
    RETURN NEW;
  END IF;
  IF public.is_superadmin() THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Doar administratorul Zmeurel (superadmin) poate modifica aprobarea pentru asociație.';
END;
$$;

DROP TRIGGER IF EXISTS tenants_association_approval_superadmin_guard ON public.tenants;
CREATE TRIGGER tenants_association_approval_superadmin_guard
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_tenant_association_approval_superadmin_only();

NOTIFY pgrst, 'reload schema';
