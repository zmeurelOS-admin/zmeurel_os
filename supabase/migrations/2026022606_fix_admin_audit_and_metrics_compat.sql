-- Fix compatibility issues for Admin Audit + Admin Analytics
-- Non-destructive: only additive changes and function replacement

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- 1) Ensure tenant_metrics_daily works with current app + refresh RPC
-- -----------------------------------------------------------------------------

create table if not exists public.tenant_metrics_daily (
  date date primary key,
  total_tenants integer not null default 0,
  total_parcele integer not null default 0,
  total_recoltari integer not null default 0,
  total_vanzari integer not null default 0,
  total_kg_cal1 numeric not null default 0,
  total_kg_cal2 numeric not null default 0,
  total_revenue_lei numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tenant_metrics_daily
  add column if not exists total_revenue_lei numeric not null default 0,
  add column if not exists updated_at timestamptz not null default now();

-- Backfill only when a legacy total_revenue column exists
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tenant_metrics_daily'
      and column_name = 'total_revenue'
  ) then
    execute '
      update public.tenant_metrics_daily
      set total_revenue_lei = coalesce(total_revenue, 0)
      where coalesce(total_revenue_lei, 0) = 0
        and coalesce(total_revenue, 0) <> 0
    ';
  end if;
end
$$;

-- Required for ON CONFLICT (date) used by refresh_tenant_metrics_daily
create unique index if not exists tenant_metrics_daily_date_key_idx
  on public.tenant_metrics_daily (date);

create index if not exists tenant_metrics_daily_date_desc_idx
  on public.tenant_metrics_daily (date desc);

alter table public.tenant_metrics_daily enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tenant_metrics_daily'
      and policyname = 'tenant_metrics_daily_superadmin_select'
  ) then
    create policy tenant_metrics_daily_superadmin_select
      on public.tenant_metrics_daily
      for select
      using (public.is_superadmin());
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 2) Fix admin_list_audit_logs return shape to match app expectations
-- -----------------------------------------------------------------------------

drop function if exists public.admin_list_audit_logs(integer, integer);

create function public.admin_list_audit_logs(
  p_limit integer default 50,
  p_offset integer default 0
)
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
  left join public.tenants t on t.id = a.target_tenant_id
  left join auth.users u on u.id = a.actor_user_id
  order by a.created_at desc
  limit greatest(coalesce(p_limit, 50), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

grant execute on function public.admin_list_audit_logs(integer, integer) to authenticated;
grant execute on function public.admin_list_audit_logs(integer, integer) to service_role;

-- -----------------------------------------------------------------------------
-- 3) Reload PostgREST schema cache
-- -----------------------------------------------------------------------------
select pg_notify('pgrst', 'reload schema');
