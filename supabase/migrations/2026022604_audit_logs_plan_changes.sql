-- Audit logs for admin plan changes

create extension if not exists pgcrypto;

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_tenant_id uuid references public.tenants(id) on delete set null,
  old_plan text,
  new_plan text
);

create index if not exists audit_logs_created_at_desc_idx
  on public.audit_logs (created_at desc);

create index if not exists audit_logs_target_tenant_idx
  on public.audit_logs (target_tenant_id);

alter table public.audit_logs enable row level security;

drop policy if exists audit_logs_superadmin_select on public.audit_logs;
create policy audit_logs_superadmin_select
on public.audit_logs
for select
using (public.is_superadmin());

drop policy if exists audit_logs_superadmin_insert on public.audit_logs;
create policy audit_logs_superadmin_insert
on public.audit_logs
for insert
with check (public.is_superadmin());

drop policy if exists audit_logs_superadmin_update on public.audit_logs;
create policy audit_logs_superadmin_update
on public.audit_logs
for update
using (public.is_superadmin())
with check (public.is_superadmin());

drop policy if exists audit_logs_superadmin_delete on public.audit_logs;
create policy audit_logs_superadmin_delete
on public.audit_logs
for delete
using (public.is_superadmin());

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
  previous_plan text;
  updated_row public.tenants%rowtype;
begin
  if not public.is_superadmin(auth.uid()) then
    raise exception 'FORBIDDEN';
  end if;

  normalized_plan := lower(trim(p_plan));

  if normalized_plan not in ('freemium', 'pro', 'enterprise') then
    raise exception 'INVALID_PLAN';
  end if;

  select t.plan
  into previous_plan
  from public.tenants t
  where t.id = p_tenant_id
  for update;

  if not found then
    raise exception 'TENANT_NOT_FOUND';
  end if;

  update public.tenants t
  set
    plan = normalized_plan,
    updated_at = now()
  where t.id = p_tenant_id
  returning * into updated_row;

  if previous_plan is distinct from normalized_plan then
    insert into public.audit_logs (
      actor_user_id,
      action,
      target_tenant_id,
      old_plan,
      new_plan
    ) values (
      auth.uid(),
      'plan_changed',
      p_tenant_id,
      previous_plan,
      normalized_plan
    );
  end if;

  return query
  select updated_row.id, updated_row.plan, updated_row.updated_at;
end;
$$;

grant execute on function public.admin_set_tenant_plan(uuid, text) to authenticated;
grant execute on function public.admin_set_tenant_plan(uuid, text) to service_role;

create or replace function public.admin_list_audit_logs(p_limit integer default 20, p_offset integer default 0)
returns table (
  id uuid,
  created_at timestamptz,
  actor_email text,
  tenant_name text,
  old_plan text,
  new_plan text,
  action text
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
    a.id,
    a.created_at,
    u.email::text as actor_email,
    t.nume_ferma as tenant_name,
    a.old_plan,
    a.new_plan,
    a.action
  from public.audit_logs a
  left join auth.users u on u.id = a.actor_user_id
  left join public.tenants t on t.id = a.target_tenant_id
  order by a.created_at desc
  limit greatest(coalesce(p_limit, 20), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

grant execute on function public.admin_list_audit_logs(integer, integer) to authenticated;
grant execute on function public.admin_list_audit_logs(integer, integer) to service_role;

create or replace function public.admin_count_audit_logs()
returns bigint
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  total_count bigint;
begin
  if not public.is_superadmin(auth.uid()) then
    raise exception 'FORBIDDEN';
  end if;

  select count(*) into total_count
  from public.audit_logs;

  return total_count;
end;
$$;

grant execute on function public.admin_count_audit_logs() to authenticated;
grant execute on function public.admin_count_audit_logs() to service_role;

notify pgrst, 'reload schema';
