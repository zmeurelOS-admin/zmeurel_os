-- Align comenzi with global superadmin RLS pattern.

alter table public.comenzi enable row level security;

drop policy if exists comenzi_superadmin_select on public.comenzi;
create policy comenzi_superadmin_select
on public.comenzi
for select
using (public.is_superadmin());

drop policy if exists comenzi_superadmin_insert on public.comenzi;
create policy comenzi_superadmin_insert
on public.comenzi
for insert
with check (public.is_superadmin());

drop policy if exists comenzi_superadmin_update on public.comenzi;
create policy comenzi_superadmin_update
on public.comenzi
for update
using (public.is_superadmin())
with check (public.is_superadmin());

drop policy if exists comenzi_superadmin_delete on public.comenzi;
create policy comenzi_superadmin_delete
on public.comenzi
for delete
using (public.is_superadmin());

notify pgrst, 'reload schema';
