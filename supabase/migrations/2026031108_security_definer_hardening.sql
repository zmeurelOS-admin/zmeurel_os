alter view if exists public.activitati_extended
  set (security_invoker = true);

alter view if exists public.parcele_extended
  set (security_invoker = true);

alter view if exists public.vanzari_extended
  set (security_invoker = true);

alter view if exists public.activitati_extra_extended
  set (security_invoker = true);

alter view if exists public.vanzari_butasi_extended
  set (security_invoker = true);

alter function public.set_audit_fields_minimal()
  set search_path = public;

alter function public.upsert_with_idempotency(text, jsonb)
  set search_path = public;

alter function public.set_sync_audit_fields()
  set search_path = public;

alter function public.set_analytics_event_context()
  set search_path = public;

alter function public.enforce_vanzari_butasi_items_tenant()
  set search_path = public;

alter function public.set_comenzi_tenant_and_audit()
  set search_path = public;

notify pgrst, 'reload schema';
