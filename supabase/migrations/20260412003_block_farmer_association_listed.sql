-- Blochează listarea directă în magazinul asociației de către fermier.
-- Fluxul corect rămâne: fermier -> ofertă -> aprobare asociație.

CREATE OR REPLACE FUNCTION public.enforce_association_listed_by_association_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_previous_listed boolean := CASE
    WHEN TG_OP = 'UPDATE' THEN COALESCE(OLD.association_listed, false)
    ELSE false
  END;
  v_is_owner boolean := false;
  v_is_assoc_staff boolean := false;
BEGIN
  IF COALESCE(NEW.association_listed, false) = true AND v_previous_listed IS DISTINCT FROM true THEN
    IF auth.role() = 'service_role' OR auth.uid() IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.tenants t
      WHERE t.id = NEW.tenant_id
        AND t.owner_user_id = auth.uid()
    )
    INTO v_is_owner;

    IF NOT v_is_owner THEN
      RETURN NEW;
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.association_members am
      WHERE am.user_id = auth.uid()
        AND am.role IN ('admin', 'moderator')
    )
    INTO v_is_assoc_staff;

    IF v_is_assoc_staff THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION
      'Listarea produselor în magazinul asociației se face doar prin fluxul de oferte. Trimite o ofertă asociației pentru aprobare.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS produse_association_listed_guard ON public.produse;

CREATE TRIGGER produse_association_listed_guard
  BEFORE INSERT OR UPDATE ON public.produse
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_association_listed_by_association_only();

NOTIFY pgrst, 'reload schema';
