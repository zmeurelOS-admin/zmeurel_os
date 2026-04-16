-- Association workspace: explicit authenticated update policy + status transition guard
-- for public shop orders handled by association staff.

ALTER POLICY comenzi_association_update
  ON public.comenzi
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.association_members am
      WHERE am.user_id = auth.uid()
        AND am.role IN ('admin', 'moderator')
    )
    AND data_origin = 'magazin_asociatie'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.association_members am
      WHERE am.user_id = auth.uid()
        AND am.role IN ('admin', 'moderator')
    )
    AND data_origin = 'magazin_asociatie'
  );

CREATE OR REPLACE FUNCTION public.enforce_association_comenzi_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF COALESCE(NEW.data_origin, '') <> 'magazin_asociatie' THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('noua', 'confirmata', 'in_livrare', 'livrata', 'anulata') THEN
    RAISE EXCEPTION 'Status invalid pentru comenzile asociației.';
  END IF;

  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'noua' AND NEW.status IN ('confirmata', 'anulata') THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'confirmata' AND NEW.status IN ('in_livrare', 'anulata') THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'in_livrare' AND NEW.status IN ('livrata', 'anulata') THEN
    RETURN NEW;
  END IF;

  -- Compat: unele medii mai vechi pot avea încă "programata"; permitem doar ieșirea
  -- spre pașii moderni fără a mai accepta scrierea acestui status.
  IF OLD.status = 'programata' AND NEW.status IN ('in_livrare', 'anulata', 'confirmata') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Tranziție invalidă pentru statusul comenzii asociației: % -> %.', OLD.status, NEW.status;
END;
$$;

DROP TRIGGER IF EXISTS comenzi_association_status_transition_guard ON public.comenzi;
CREATE TRIGGER comenzi_association_status_transition_guard
  BEFORE INSERT OR UPDATE OF status ON public.comenzi
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_association_comenzi_status_transition();

NOTIFY pgrst, 'reload schema';
