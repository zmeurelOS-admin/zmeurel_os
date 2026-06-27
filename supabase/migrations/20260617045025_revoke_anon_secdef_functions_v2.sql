
-- W-1 (v2): REVOKE from PUBLIC (which anon inherits), then re-grant to
-- authenticated only for RPCs that real users need to call directly.

-- Admin/superadmin-only: no re-grant needed (internal is_superadmin() guard suffices)
REVOKE EXECUTE ON FUNCTION public.admin_count_audit_logs() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_list_audit_logs(integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_list_tenants() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_set_tenant_plan(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.refresh_tenant_metrics_daily(date) FROM PUBLIC;

-- Auth-required user RPCs: revoke from PUBLIC, re-grant to authenticated
REVOKE EXECUTE ON FUNCTION public.check_and_increment_ai_usage(uuid, date, integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.check_and_increment_ai_usage(uuid, date, integer) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.create_recoltare_with_stock(date, uuid, uuid, numeric, numeric, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.create_recoltare_with_stock(date, uuid, uuid, numeric, numeric, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.delete_demo_for_tenant(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.delete_demo_for_tenant(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.delete_vanzare_with_stock(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.delete_vanzare_with_stock(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.seed_demo_for_tenant(uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.seed_demo_for_tenant(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.seed_demo_for_tenant(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.seed_demo_for_tenant(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.update_my_farm_name(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.update_my_farm_name(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.upsert_plan_tratament_cu_linii(uuid, jsonb, jsonb, uuid[], integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.upsert_plan_tratament_cu_linii(uuid, jsonb, jsonb, uuid[], integer) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.upsert_with_idempotency(text, jsonb) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.upsert_with_idempotency(text, jsonb) TO authenticated;
;
