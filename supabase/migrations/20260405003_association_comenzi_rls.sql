-- ERP asociație: citire + actualizare status pentru comenzi din vitrina asociației.

CREATE POLICY comenzi_association_select
  ON public.comenzi
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.association_members am
      WHERE am.user_id = auth.uid()
    )
    AND data_origin = 'magazin_asociatie'
  );

CREATE POLICY comenzi_association_update
  ON public.comenzi
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.association_members am
      WHERE am.user_id = auth.uid()
        AND am.role IN ('admin', 'moderator')
    )
    AND data_origin = 'magazin_asociatie'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.association_members am
      WHERE am.user_id = auth.uid()
        AND am.role IN ('admin', 'moderator')
    )
    AND data_origin = 'magazin_asociatie'
  );

CREATE OR REPLACE FUNCTION public.enforce_comenzi_association_field_updates()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  is_assoc_staff boolean := false;
BEGIN
  IF NEW.tenant_id = public.current_tenant_id() THEN
    RETURN NEW;
  END IF;
  IF public.is_superadmin() THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.association_members am
    WHERE am.user_id = auth.uid()
      AND am.role IN ('admin', 'moderator')
  )
  INTO is_assoc_staff;

  IF NOT is_assoc_staff THEN
    RETURN NEW;
  END IF;

  IF COALESCE(OLD.data_origin, '') <> 'magazin_asociatie' THEN
    RAISE EXCEPTION 'Comanda nu este din magazinul asociației.';
  END IF;

  IF (
    OLD.id IS DISTINCT FROM NEW.id
    OR OLD.tenant_id IS DISTINCT FROM NEW.tenant_id
    OR OLD.client_id IS DISTINCT FROM NEW.client_id
    OR OLD.client_nume_manual IS DISTINCT FROM NEW.client_nume_manual
    OR OLD.telefon IS DISTINCT FROM NEW.telefon
    OR OLD.locatie_livrare IS DISTINCT FROM NEW.locatie_livrare
    OR OLD.data_comanda IS DISTINCT FROM NEW.data_comanda
    OR OLD.data_livrare IS DISTINCT FROM NEW.data_livrare
    OR OLD.cantitate_kg IS DISTINCT FROM NEW.cantitate_kg
    OR OLD.pret_per_kg IS DISTINCT FROM NEW.pret_per_kg
    OR OLD.total IS DISTINCT FROM NEW.total
    OR OLD.produs_id IS DISTINCT FROM NEW.produs_id
    OR OLD.observatii IS DISTINCT FROM NEW.observatii
    OR OLD.linked_vanzare_id IS DISTINCT FROM NEW.linked_vanzare_id
    OR OLD.parent_comanda_id IS DISTINCT FROM NEW.parent_comanda_id
    OR OLD.created_at IS DISTINCT FROM NEW.created_at
    OR OLD.demo_seed_id IS DISTINCT FROM NEW.demo_seed_id
    OR OLD.data_origin IS DISTINCT FROM NEW.data_origin
  ) THEN
    RAISE EXCEPTION 'Membrii asociației pot modifica doar statusul comenzii.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comenzi_association_field_guard ON public.comenzi;
CREATE TRIGGER comenzi_association_field_guard
  BEFORE UPDATE ON public.comenzi
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_comenzi_association_field_updates();

NOTIFY pgrst, 'reload schema';
