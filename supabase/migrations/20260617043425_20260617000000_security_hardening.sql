-- =============================================================
-- Security Hardening — 2026-06-17
-- Audit findings: C1, C2, W1, W2, W3, W4, W6
-- =============================================================

-- ---------------------------------------------------------------
-- [C1] campaign_leaderboard: strip non-SELECT anon/authenticated
--      grants that serve no purpose on a non-updatable view.
--      SELECT stays for anon (intentional: public shop leaderboard).
--      SECURITY DEFINER is kept because the view must read
--      shop_orders which are behind RLS; long-term the view should
--      be replaced with a SECURITY DEFINER RPC that accepts a
--      mandatory campaign_id parameter.
-- ---------------------------------------------------------------
DO $$ BEGIN
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON public.campaign_leaderboard FROM anon, authenticated;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ---------------------------------------------------------------
-- [C2 / W4] Tighten function EXECUTE grants.
--
-- Legend:
--   ADMIN-ONLY  → revoke from anon AND authenticated
--                 (service_role bypasses grants and always works)
--   TENANT-OPS  → revoke from anon only (authenticated users
--                 still need these; internal guards enforce authz)
--   TRIGGER-FNS → revoke from anon (not callable via REST anyway,
--                 but cleaning up unnecessary grants is good hygiene)
--   KEEP-ANON   → do not touch (needed for public shop flow)
-- ---------------------------------------------------------------

-- ADMIN-ONLY
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.admin_count_audit_logs() FROM anon, authenticated; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.admin_list_audit_logs(integer, integer) FROM anon, authenticated; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.admin_list_tenants() FROM anon, authenticated; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.admin_set_tenant_plan(uuid, text) FROM anon, authenticated; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.refresh_tenant_metrics_daily(date) FROM anon, authenticated; EXCEPTION WHEN undefined_function THEN NULL; END $$;
-- event-trigger function only in prod; not callable via REST but clean up
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated; EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- TENANT-OPS: revoke from anon, keep for authenticated
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.check_and_increment_ai_usage(uuid, date, integer) FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, jsonb, text, text) FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.create_recoltare_with_stock(date, uuid, uuid, numeric, numeric, text) FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.create_recoltare_with_stock(date, uuid, uuid, numeric, numeric, text, uuid) FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.create_vanzare_with_stock(date, uuid, uuid, numeric, numeric, text, text, text, text, uuid, text) FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.delete_comanda_atomic(uuid, uuid) FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.delete_demo_for_tenant(uuid) FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.delete_recoltare_with_stock(uuid) FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.delete_vanzare_with_stock(uuid) FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.deliver_order_atomic(uuid, numeric, text, date) FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.deliver_shop_order_atomic(uuid, text) FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.deliver_shop_order_atomic_partial(uuid, numeric, text, date) FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.generate_business_id(text) FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.generate_farmer_weekly_summary(date) FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.get_association_role(uuid) FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.list_association_farmer_legal_status() FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.list_shop_orders_in_delivery_today() FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.mark_association_order_delivered_atomic(uuid, uuid[]) FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.reopen_comanda_atomic(uuid, uuid) FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.reorder_shop_deliveries_today(uuid[]) FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.resolve_recoltare_stock_identity(uuid, text, uuid) FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.seed_demo_for_tenant(uuid) FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.seed_demo_for_tenant(uuid, text) FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.sync_recoltare_stock_movements(uuid, uuid, uuid, date, numeric, numeric, text) FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.tenant_has_core_data(uuid) FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.update_my_farm_name(text) FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.update_recoltare_with_stock(uuid, date, uuid, uuid, numeric, numeric, text) FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.update_vanzare_with_stock(uuid, date, uuid, numeric, numeric, text, text, uuid) FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.upsert_plan_tratament_cu_linii(uuid, jsonb, jsonb, uuid[], integer) FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.upsert_with_idempotency(text, jsonb) FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.user_can_manage_tenant(uuid, uuid) FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.validate_suprafata_culturi(uuid, numeric, uuid) FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- TRIGGER functions: not callable via REST but remove anon grant for hygiene
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.check_culturi_suprafata() FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.enforce_association_listed_by_association_only() FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.enforce_produse_association_field_updates() FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.enforce_produse_requires_legal_docs() FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.enforce_superadmin_for_plan_change() FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.enforce_tenant_association_approval_superadmin_only() FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.enforce_vanzari_butasi_items_tenant() FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.handle_auth_user_created() FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user_profile() FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.protect_profiles_privileged_fields() FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.set_analytics_event_context() FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.set_audit_fields_minimal() FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.set_comenzi_tenant_and_audit() FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.set_sync_audit_fields() FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.set_tenant_id_from_owner() FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.set_vanzari_butasi_tenant_and_public_id() FROM anon; EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- Functions intentionally kept for anon (public shop flow):
--   place_preorder_atomic, upsert_shop_customer,
--   set_shop_customer_acquisition_source_once,
--   check_recent_shop_order, get_public_farmer_card,
--   is_legal_docs_complete, is_superadmin, current_tenant_id

-- ---------------------------------------------------------------
-- [W1] shop_campaigns: add INSERT + DELETE (prod was missing them)
-- ---------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY shop_campaigns_insert ON public.shop_campaigns
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id = current_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY shop_campaigns_delete ON public.shop_campaigns
    FOR DELETE TO authenticated
    USING (tenant_id = current_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------
-- [W2] planuri_template: add superadmin write (prod was read-only)
-- ---------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY planuri_template_superadmin_write ON public.planuri_template
    FOR ALL USING (is_superadmin()) WITH CHECK (is_superadmin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY planuri_template_linii_superadmin_write ON public.planuri_template_linii
    FOR ALL USING (is_superadmin()) WITH CHECK (is_superadmin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------
-- [W3] consent_events: explicit INSERT block — documents that
--      inserts go through Edge Functions with service_role only.
--      service_role bypasses RLS and is unaffected by this policy.
-- ---------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY consent_events_insert_service_only ON public.consent_events
    FOR INSERT WITH CHECK (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------
-- [W6] notifications: explicit INSERT block — documents that
--      inserts go through create_notification() (service_role).
-- ---------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY notifications_insert_service_only ON public.notifications
    FOR INSERT WITH CHECK (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
;
