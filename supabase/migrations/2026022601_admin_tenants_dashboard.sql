-- Admin tenants plan management (superadmin only)

alter table public.profiles
  add column if not exists is_superadmin boolean not null default false;

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

alter table public.tenants
  add column if not exists plan text not null default 'freemium';

update public.tenants
set plan = coalesce(nullif(plan, ''), 'freemium')
where true;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tenants_plan_check'
      and conrelid = 'public.tenants'::regclass
  ) then
    alter table public.tenants
      add constraint tenants_plan_check
      check (plan in ('freemium', 'pro', 'enterprise'));
  end if;
end $$;

alter table public.tenants enable row level security;

drop policy if exists tenants_owner_or_superadmin_select on public.tenants;
create policy tenants_owner_or_superadmin_select
on public.tenants
for select
using (
  owner_user_id = auth.uid()
  or public.is_superadmin()
);

drop policy if exists tenants_owner_or_superadmin_insert on public.tenants;
create policy tenants_owner_or_superadmin_insert
on public.tenants
for insert
with check (
  owner_user_id = auth.uid()
  or public.is_superadmin()
);

drop policy if exists tenants_superadmin_update on public.tenants;
create policy tenants_superadmin_update
on public.tenants
for update
using (public.is_superadmin())
with check (public.is_superadmin());

drop policy if exists tenants_superadmin_delete on public.tenants;
create policy tenants_superadmin_delete
on public.tenants
for delete
using (public.is_superadmin());

create or replace function public.admin_list_tenants()
returns table (
  tenant_id uuid,
  tenant_name text,
  owner_email text,
  plan text,
  created_at timestamptz,
  parcels_count bigint,
  users_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_superadmin(auth.uid()) then
    raise exception 'FORBIDDEN';
  end if;

  return query
  select
    t.id as tenant_id,
    t.nume_ferma as tenant_name,
    u.email::text as owner_email,
    t.plan,
    t.created_at,
    (
      select count(*)
      from public.parcele p
      where p.tenant_id = t.id
    ) as parcels_count,
    (
      select count(*)
      from auth.users ux
      where ux.id = t.owner_user_id
    ) as users_count
  from public.tenants t
  left join auth.users u on u.id = t.owner_user_id
  order by t.created_at desc nulls last;
end;
$$;

grant execute on function public.admin_list_tenants() to authenticated;
grant execute on function public.admin_list_tenants() to service_role;

create or replace function public.admin_set_tenant_plan(p_tenant_id uuid, p_plan text)
returns table (
  id uuid,
  plan text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_plan text;
begin
  if not public.is_superadmin(auth.uid()) then
    raise exception 'FORBIDDEN';
  end if;

  normalized_plan := lower(trim(p_plan));

  if normalized_plan not in ('freemium', 'pro', 'enterprise') then
    raise exception 'INVALID_PLAN';
  end if;

  return query
  update public.tenants t
  set
    plan = normalized_plan,
    updated_at = now()
  where t.id = p_tenant_id
  returning t.id, t.plan, t.updated_at;
end;
$$;

grant execute on function public.admin_set_tenant_plan(uuid, text) to authenticated;
grant execute on function public.admin_set_tenant_plan(uuid, text) to service_role;

notify pgrst, 'reload schema';
