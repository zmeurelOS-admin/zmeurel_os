-- Ensure superadmin can update tenant plan through RLS on public.tenants.
-- Idempotent and safe for existing deployments.

alter table public.tenants enable row level security;

create or replace function public.is_superadmin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = check_user_id
      and coalesce(p.is_superadmin, false) = true
  );
$$;

grant execute on function public.is_superadmin(uuid) to authenticated;
grant execute on function public.is_superadmin(uuid) to service_role;

drop policy if exists tenants_superadmin_update on public.tenants;
create policy tenants_superadmin_update
on public.tenants
for update
using (public.is_superadmin(auth.uid()))
with check (public.is_superadmin(auth.uid()));

notify pgrst, 'reload schema';
