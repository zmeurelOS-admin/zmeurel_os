-- =============================================================
-- Security audit hardening — 2026-06-18
-- Fixes: C-1 (is_superadmin info-leak), C-2 (user_can_manage_tenant anon),
--        C-4 (shop_orders open INSERT), W-1 (trigger fn anon exposure),
--        W-3 (crops superadmin policies in dev), W-7 (duplicate policies)
-- =============================================================

-- ---------------------------------------------------------------
-- C-1: Patch is_superadmin to return false for unauthenticated callers.
-- The function must stay callable (used in {public} RLS policies),
-- but must not disclose superadmin status to anonymous probers.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_superadmin(
  check_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = check_user_id
      AND coalesce(p.is_superadmin, false) = true
  );
END;
$$;

-- ---------------------------------------------------------------
-- C-2: Block anon from probing tenant ownership graph.
-- user_can_manage_tenant is not used in any RLS policy qual,
-- so revoking from anon is safe and has no side-effects.
-- ---------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.user_can_manage_tenant(uuid, uuid) FROM anon;

-- ---------------------------------------------------------------
-- W-1: Revoke anon access to trigger/helper SECURITY DEFINER functions.
-- These are internal trigger callbacks, not REST API endpoints.
-- Wrapped in exception blocks so the migration survives if a function
-- has a slightly different overload or does not yet exist.
-- ---------------------------------------------------------------
DO $$
DECLARE
  sig text;
BEGIN
  FOREACH sig IN ARRAY ARRAY[
    'public.handle_auth_user_created()',
    'public.set_tenant_id_from_owner()',
    'public.set_audit_fields_minimal()',
    'public.set_sync_audit_fields()',
    'public.set_comenzi_tenant_and_audit()',
    'public.set_analytics_event_context()',
    'public.set_vanzari_butasi_tenant_and_public_id()',
    'public.enforce_produse_association_field_updates()',
    'public.enforce_vanzari_butasi_items_tenant()',
    'public.enforce_association_listed_by_association_only()',
    'public.enforce_produse_requires_legal_docs()',
    'public.enforce_tenant_association_approval_superadmin_only()',
    'public.check_culturi_suprafata()',
    'public.generate_business_id(text)',
    'public.validate_suprafata_culturi(uuid, numeric, uuid)',
    'public.is_legal_docs_complete(uuid)',
    'public.tenant_has_core_data(uuid)',
    'public.current_tenant_id()'
  ] LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', sig);
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------
-- C-4: Require an active campaign for anon INSERT on shop_orders.
-- Old policy: tenant_id IN (all tenants) — allowed fake orders on any tenant.
-- New policy: must link to an active campaign on the same tenant.
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS "anon can insert shop_orders" ON public.shop_orders;
CREATE POLICY "anon can insert shop_orders"
  ON public.shop_orders
  FOR INSERT TO anon
  WITH CHECK (
    campaign_id IS NOT NULL
    AND tenant_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.shop_campaigns sc
      WHERE sc.id = shop_orders.campaign_id
        AND sc.tenant_id = shop_orders.tenant_id
        AND sc.status = 'active'
    )
    AND customer_name IS NOT NULL
    AND length(trim(customer_name)) >= 2
    AND customer_phone IS NOT NULL
    AND length(trim(customer_phone)) >= 9
    AND items IS NOT NULL
    AND jsonb_typeof(items) = 'array'
    AND jsonb_array_length(items) > 0
    AND status = 'noua'
    AND notified_wa = false
  );

-- ---------------------------------------------------------------
-- W-3: Crops superadmin policies.
-- Present in prod, missing in dev (modul-tratamente regression).
-- DROP IF EXISTS makes this migration safe to run on both environments.
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS crops_superadmin_select ON public.crops;
DROP POLICY IF EXISTS crops_superadmin_insert ON public.crops;
DROP POLICY IF EXISTS crops_superadmin_update ON public.crops;
DROP POLICY IF EXISTS crops_superadmin_delete ON public.crops;

CREATE POLICY crops_superadmin_select ON public.crops
  FOR SELECT TO public USING (public.is_superadmin());

CREATE POLICY crops_superadmin_insert ON public.crops
  FOR INSERT TO public WITH CHECK (public.is_superadmin());

CREATE POLICY crops_superadmin_update ON public.crops
  FOR UPDATE TO public
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY crops_superadmin_delete ON public.crops
  FOR DELETE TO public USING (public.is_superadmin());

-- ---------------------------------------------------------------
-- W-7: Drop duplicate authenticated SELECT/UPDATE policies on shop_orders.
-- shop_orders_authenticated_select/update are the canonical ones (kept).
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS "authenticated can select shop_orders" ON public.shop_orders;
DROP POLICY IF EXISTS "authenticated can update shop_orders" ON public.shop_orders;

NOTIFY pgrst, 'reload schema';
;
