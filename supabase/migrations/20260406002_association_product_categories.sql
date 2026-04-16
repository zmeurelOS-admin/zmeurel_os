-- Association shop categories for public catalog filtering and sorting.
-- Keeps ERP product categories intact; adds a separate association-specific field.

ALTER TABLE public.produse
  ADD COLUMN IF NOT EXISTS association_category text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'produse_association_category_check'
  ) THEN
    ALTER TABLE public.produse
      ADD CONSTRAINT produse_association_category_check
      CHECK (
        association_category IS NULL
        OR association_category IN (
          'fructe_legume',
          'lactate_branzeturi',
          'carne_mezeluri',
          'miere_apicole',
          'conserve_muraturi',
          'panificatie_patiserie',
          'bauturi',
          'oua',
          'altele'
        )
      );
  END IF;
END $$;

COMMENT ON COLUMN public.produse.association_category IS
  'Public association shop category used for filters/sorting; separate from ERP categorie.';

CREATE OR REPLACE FUNCTION public.enforce_produse_association_field_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_tenant_member boolean;
  is_assoc_staff   boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.tenant_id = OLD.tenant_id
  )
  INTO is_tenant_member;

  IF is_tenant_member THEN
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

  IF (OLD.id IS DISTINCT FROM NEW.id
      OR OLD.tenant_id IS DISTINCT FROM NEW.tenant_id
      OR OLD.nume IS DISTINCT FROM NEW.nume
      OR OLD.descriere IS DISTINCT FROM NEW.descriere
      OR OLD.categorie IS DISTINCT FROM NEW.categorie
      OR OLD.unitate_vanzare IS DISTINCT FROM NEW.unitate_vanzare
      OR OLD.gramaj_per_unitate IS DISTINCT FROM NEW.gramaj_per_unitate
      OR OLD.approximate_weight IS DISTINCT FROM NEW.approximate_weight
      OR OLD.pret_unitar IS DISTINCT FROM NEW.pret_unitar
      OR OLD.moneda IS DISTINCT FROM NEW.moneda
      OR OLD.poza_1_url IS DISTINCT FROM NEW.poza_1_url
      OR OLD.poza_2_url IS DISTINCT FROM NEW.poza_2_url
      OR OLD.status IS DISTINCT FROM NEW.status
      OR OLD.created_at IS DISTINCT FROM NEW.created_at
      OR OLD.data_origin IS DISTINCT FROM NEW.data_origin
      OR OLD.demo_seed_id IS DISTINCT FROM NEW.demo_seed_id) THEN
    RAISE EXCEPTION 'Membrii asociației pot modifica doar association_listed, association_price și association_category';
  END IF;

  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
