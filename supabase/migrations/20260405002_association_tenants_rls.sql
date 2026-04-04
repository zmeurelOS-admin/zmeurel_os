-- Association workspace: membrii pot citi tenants pentru ERP; adminii asociației pot actualiza doar is_association_approved.
-- Extinde citirea produselor pentru statistici ERP (inclusiv fermă suspendată).

DROP POLICY IF EXISTS association_members_read_approved_products ON public.produse;
CREATE POLICY association_members_read_products
  ON public.produse
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.association_members am
      WHERE am.user_id = auth.uid()
    )
  );

-- ─── SELECT: orice membru asociație vede datele de bază ale fermelor (ERP producători) ───
DROP POLICY IF EXISTS tenants_select_association_members ON public.tenants;
CREATE POLICY tenants_select_association_members
  ON public.tenants
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.association_members am
      WHERE am.user_id = auth.uid()
    )
  );

-- ─── UPDATE: admin asociație poate modifica rânduri (coloanele sunt filtrate de trigger) ───
DROP POLICY IF EXISTS tenants_update_association_admin ON public.tenants;
CREATE POLICY tenants_update_association_admin
  ON public.tenants
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.association_members am
      WHERE am.user_id = auth.uid()
        AND am.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.association_members am
      WHERE am.user_id = auth.uid()
        AND am.role = 'admin'
    )
  );

-- ─── Trigger: admin asociație → doar is_association_approved + updated_at ───
CREATE OR REPLACE FUNCTION public.enforce_tenants_assoc_admin_updates()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  is_assoc_admin boolean := false;
BEGIN
  IF NEW.owner_user_id IS NOT DISTINCT FROM auth.uid() THEN
    RETURN NEW;
  END IF;
  IF public.is_superadmin() THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.association_members am
    WHERE am.user_id = auth.uid()
      AND am.role = 'admin'
  )
  INTO is_assoc_admin;

  IF NOT is_assoc_admin THEN
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
  ) THEN
    RAISE EXCEPTION 'Administratorii asociației pot modifica doar aprobarea pentru magazin (is_association_approved).';
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
