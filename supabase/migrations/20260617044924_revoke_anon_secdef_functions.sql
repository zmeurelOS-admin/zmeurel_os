
-- W-1: Revoke EXECUTE from anon for auth-required SECURITY DEFINER functions.
-- Preserves anon access for: current_tenant_id (used in RLS), is_superadmin,
-- user_can_manage_tenant, tenant_has_core_data, generate_business_id,
-- is_legal_docs_complete, get_public_farmer_card, place_preorder_atomic (both),
-- check_recent_shop_order, and all trigger functions.

REVOKE EXECUTE ON FUNCTION public.admin_count_audit_logs() FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_audit_logs(integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_tenants() FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_tenant_plan(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_and_increment_ai_usage(uuid, date, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_recoltare_with_stock(date, uuid, uuid, numeric, numeric, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_demo_for_tenant(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_vanzare_with_stock(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.refresh_tenant_metrics_daily(date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.seed_demo_for_tenant(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.seed_demo_for_tenant(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_my_farm_name(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.upsert_plan_tratament_cu_linii(uuid, jsonb, jsonb, uuid[], integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.upsert_with_idempotency(text, jsonb) FROM anon;
;
