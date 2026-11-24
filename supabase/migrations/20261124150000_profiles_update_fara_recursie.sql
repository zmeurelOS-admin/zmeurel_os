-- Politica profiles_update_own citea din nou `profiles` în WITH CHECK, iar Postgres refuza orice actualizare
-- a profilului din aplicație cu „infinite recursion detected in policy for relation profiles” (ex. telefonul).
-- APLICATĂ în producție pe 24.11.2026 (MCP). Aceleași protecții: id-ul propriu, is_superadmin, tenant_id,
-- ai_messages_count, last_ai_usage_date neschimbate. Funcția răspunde doar pentru propriul cont. Fără drop.

create or replace function public.profil_campuri_protejate_neschimbate(
  p_id uuid, p_is_superadmin boolean, p_tenant_id uuid, p_ai_count integer, p_ai_date date)
returns boolean language sql stable security definer set search_path = public as $$
  select p_id = auth.uid() and exists (
    select 1 from public.profiles p
     where p.id = p_id
       and p.is_superadmin = p_is_superadmin
       and p.tenant_id is not distinct from p_tenant_id
       and p.ai_messages_count is not distinct from p_ai_count
       and p.last_ai_usage_date is not distinct from p_ai_date);
$$;
revoke all on function public.profil_campuri_protejate_neschimbate(uuid, boolean, uuid, integer, date) from public, anon;
grant execute on function public.profil_campuri_protejate_neschimbate(uuid, boolean, uuid, integer, date) to authenticated, service_role;

alter policy profiles_update_own on public.profiles
  with check (id = (select auth.uid())
    and public.profil_campuri_protejate_neschimbate(id, is_superadmin, tenant_id, ai_messages_count, last_ai_usage_date));
