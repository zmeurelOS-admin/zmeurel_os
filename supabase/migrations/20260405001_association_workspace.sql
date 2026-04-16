-- Association workspace: members table, produse association listing/pricing, RLS, seed admin.

-- ─── 1. association_members ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.association_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'moderator', 'viewer')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  invited_by  uuid REFERENCES auth.users(id),
  UNIQUE (user_id)
);

COMMENT ON TABLE public.association_members IS
  'Platform users who can manage or view association shop data; distinct from farm tenants.';

-- ─── 2. RLS: association_members ───────────────────────────────────────────────

ALTER TABLE public.association_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "association_members_select_own"
  ON public.association_members FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "association_members_select_superadmin"
  ON public.association_members FOR SELECT
  USING (public.is_superadmin());

CREATE POLICY "association_members_insert_privileged"
  ON public.association_members FOR INSERT
  WITH CHECK (
    public.is_superadmin()
    OR EXISTS (
      SELECT 1 FROM public.association_members am
      WHERE am.user_id = auth.uid()
        AND am.role = 'admin'
    )
  );

CREATE POLICY "association_members_update_privileged"
  ON public.association_members FOR UPDATE
  USING (
    public.is_superadmin()
    OR EXISTS (
      SELECT 1 FROM public.association_members am
      WHERE am.user_id = auth.uid()
        AND am.role = 'admin'
    )
  )
  WITH CHECK (
    public.is_superadmin()
    OR EXISTS (
      SELECT 1 FROM public.association_members am
      WHERE am.user_id = auth.uid()
        AND am.role = 'admin'
    )
  );

CREATE POLICY "association_members_delete_privileged"
  ON public.association_members FOR DELETE
  USING (
    public.is_superadmin()
    OR EXISTS (
      SELECT 1 FROM public.association_members am
      WHERE am.user_id = auth.uid()
        AND am.role = 'admin'
    )
  );

-- ─── 3. produse: association listing & price override ─────────────────────────

ALTER TABLE public.produse ADD COLUMN IF NOT EXISTS association_listed boolean NOT NULL DEFAULT false;
ALTER TABLE public.produse ADD COLUMN IF NOT EXISTS association_price numeric(10, 2);

COMMENT ON COLUMN public.produse.association_listed IS
  'When true, product may appear in the association public shop (subject to tenant approval).';
COMMENT ON COLUMN public.produse.association_price IS
  'If set, overrides pret_unitar in association shop; if null, pret_unitar is used.';

-- ─── 4a. produse: association members may read approved tenants' catalogs ─

CREATE POLICY "association_members_read_approved_products"
  ON public.produse FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.association_members am
      WHERE am.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id = produse.tenant_id
        AND t.is_association_approved = true
    )
  );

-- ─── 4b. produse: admin/moderator may update only association fields ────────
-- Column-level enforcement via trigger; policy gates who may attempt UPDATE.

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
      OR OLD.pret_unitar IS DISTINCT FROM NEW.pret_unitar
      OR OLD.moneda IS DISTINCT FROM NEW.moneda
      OR OLD.poza_1_url IS DISTINCT FROM NEW.poza_1_url
      OR OLD.poza_2_url IS DISTINCT FROM NEW.poza_2_url
      OR OLD.status IS DISTINCT FROM NEW.status
      OR OLD.created_at IS DISTINCT FROM NEW.created_at
      OR OLD.data_origin IS DISTINCT FROM NEW.data_origin
      OR OLD.demo_seed_id IS DISTINCT FROM NEW.demo_seed_id) THEN
    RAISE EXCEPTION 'Membrii asociației pot modifica doar association_listed și association_price';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS produse_association_field_guard ON public.produse;
CREATE TRIGGER produse_association_field_guard
  BEFORE UPDATE ON public.produse
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_produse_association_field_updates();

CREATE POLICY "produse_update_association_staff"
  ON public.produse FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.association_members am
      WHERE am.user_id = auth.uid()
        AND am.role IN ('admin', 'moderator')
    )
    AND EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id = produse.tenant_id
        AND t.is_association_approved = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.association_members am
      WHERE am.user_id = auth.uid()
        AND am.role IN ('admin', 'moderator')
    )
    AND EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id = produse.tenant_id
        AND t.is_association_approved = true
    )
  );

-- ─── 5. comenzi.data_origin ───────────────────────────────────────────────────
-- Value ''magazin_asociatie'' is used at application level; column already exists as text.

-- ─── 6. Seed first association admin (idempotent) ───────────────────────────
-- Superadmin email setat manual dupa deploy via Supabase Dashboard.
-- Seed-ul initial pentru public.association_members se face operational,
-- fara email personal hardcodat in migrari.

-- ─── 7. RPC helper ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_association_role(p_user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT am.role
  FROM public.association_members am
  WHERE am.user_id = p_user_id
    AND (
      p_user_id = (SELECT auth.uid())
      OR public.is_superadmin()
    )
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_association_role(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_association_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_association_role(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
