-- Allow tenant owners to update their own tenant (farm name, etc).
-- Keeps existing superadmin update policy intact.

alter table public.tenants enable row level security;

drop policy if exists tenants_owner_update on public.tenants;
create policy tenants_owner_update
on public.tenants
for update
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

notify pgrst, 'reload schema';
