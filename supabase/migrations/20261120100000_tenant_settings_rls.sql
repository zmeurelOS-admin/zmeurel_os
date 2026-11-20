-- Corectura de dimineață, 20.11.2026 (prompt 09): politicile RLS de pe `public.tenant_settings`.
--
-- NU a fost aplicată din cod. O aprobă și o rulează Andrei, ÎMPREUNĂ cu `20261120090000_redesign_noapte.sql`.
--
-- De ce: migrarea `2026033004_create_tenant_settings.sql` a pus politici pe modelul vechi,
-- `tenant_id = current_setting('app.current_tenant_id', true)::uuid`. Aplicația nu setează niciodată
-- `app.current_tenant_id`, deci:
--   - citirea întoarce mereu 0 rânduri (tabelul e gol în producție; `latitudine_default` nu s-a salvat niciodată);
--   - insert / upsert pică pe RLS.
-- Fără corectura asta, prețul standard, „Ce arată Acasă” și răspunsul la „Începem extrasezonul?” nu se salvează.
--
-- Ce face: înlocuiește cele trei politici cu modelul folosit de celelalte tabele (`current_tenant_id()`):
--   - SELECT: orice membru al fermei (proprietar sau operator) citește setările fermei lui;
--   - INSERT / UPDATE: doar proprietarul fermei (`is_tenant_owner(tenant_id)`); operatorii doar citesc;
--   - fără politică de DELETE (rândul nu se șterge din aplicație).
--
-- Funcțiile folosite: `public.current_tenant_id()` (ultima definiție: `20260621102224_...`) și
-- `public.is_tenant_owner(p_tenant uuid)` (`20260619064820_operator_module_db_guards_helpers.sql`).
--
-- Reguli respectate: fără `update` / `delete` pe date, fără alte tabele. Se poate rula de două ori.

alter table public.tenant_settings enable row level security;

drop policy if exists "Users can view own tenant settings" on public.tenant_settings;
drop policy if exists "Users can update own tenant settings" on public.tenant_settings;
drop policy if exists "Users can insert own tenant settings" on public.tenant_settings;

drop policy if exists tenant_settings_select on public.tenant_settings;
drop policy if exists tenant_settings_insert on public.tenant_settings;
drop policy if exists tenant_settings_update on public.tenant_settings;

create policy tenant_settings_select on public.tenant_settings
  for select
  to authenticated
  using (tenant_id = public.current_tenant_id());

create policy tenant_settings_insert on public.tenant_settings
  for insert
  to authenticated
  with check ((tenant_id = public.current_tenant_id()) and public.is_tenant_owner(tenant_id));

create policy tenant_settings_update on public.tenant_settings
  for update
  to authenticated
  using ((tenant_id = public.current_tenant_id()) and public.is_tenant_owner(tenant_id))
  with check ((tenant_id = public.current_tenant_id()) and public.is_tenant_owner(tenant_id));
