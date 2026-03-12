-- Fix runtime mismatches for admin RPCs + metrics refresh compatibility
-- Safe and idempotent: does not drop tables or data.

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- 1) admin_list_audit_logs: force exact return shape used by app
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
    a.id::uuid,
    a.created_at::timestamptz,
    u.email::text as actor_email,
    t.nume_ferma::text as tenant_name,
    a.old_plan::text,
    a.new_plan::text,
    a.action::text
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

drop function if exists public.admin_count_audit_logs();

create function public.admin_count_audit_logs()
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

  select count(*)::bigint
  into total_count
  from public.audit_logs;

  return total_count;
end;
$$;

grant execute on function public.admin_count_audit_logs() to authenticated;
grant execute on function public.admin_count_audit_logs() to service_role;

-- -----------------------------------------------------------------------------
-- 2) admin_list_tenants: force exact return shape used by app
-- -----------------------------------------------------------------------------
drop function if exists public.admin_list_tenants();

create function public.admin_list_tenants()
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
    t.id::uuid as tenant_id,
    t.nume_ferma::text as tenant_name,
    u.email::text as owner_email,
    t.plan::text,
    t.created_at::timestamptz,
    (
      select count(*)::bigint
      from public.parcele p
      where p.tenant_id = t.id
    ) as parcels_count,
    (
      select count(*)::bigint
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

-- -----------------------------------------------------------------------------
-- 3) Metrics compatibility: ensure refresh function and table columns align
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

create unique index if not exists tenant_metrics_daily_date_key_idx
  on public.tenant_metrics_daily (date);

create index if not exists tenant_metrics_daily_date_desc_idx
  on public.tenant_metrics_daily (date desc);

create or replace function public.refresh_tenant_metrics_daily(p_date date default current_date)
returns public.tenant_metrics_daily
language plpgsql
security definer
set search_path = public
as $$
declare
  target_date date := coalesce(p_date, current_date);
  metrics_row public.tenant_metrics_daily;
  butasi_revenue numeric := 0;
  butasi_revenue_expr text := '0';
  butasi_date_column text := null;
begin
  if auth.uid() is not null and not public.is_superadmin(auth.uid()) then
    raise exception 'FORBIDDEN';
  end if;

  if to_regclass('public.vanzari_butasi') is not null then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'vanzari_butasi'
        and column_name = 'total_lei'
    ) then
      butasi_revenue_expr := 'coalesce(sum(coalesce(vb.total_lei, 0)), 0)';
    elsif exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'vanzari_butasi'
        and column_name = 'valoare_totala_lei'
    ) then
      butasi_revenue_expr := 'coalesce(sum(coalesce(vb.valoare_totala_lei, 0)), 0)';
    elsif exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'vanzari_butasi'
        and column_name = 'cantitate_butasi'
    ) and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'vanzari_butasi'
        and column_name = 'pret_unitar_lei'
    ) then
      butasi_revenue_expr := 'coalesce(sum(coalesce(vb.cantitate_butasi, 0) * coalesce(vb.pret_unitar_lei, 0)), 0)';
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'vanzari_butasi'
        and column_name = 'data_comanda'
    ) then
      butasi_date_column := 'data_comanda';
    elsif exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'vanzari_butasi'
        and column_name = 'data'
    ) then
      butasi_date_column := 'data';
    end if;

    if butasi_date_column is not null then
      execute format(
        'select %s from public.vanzari_butasi vb where vb.%I = $1',
        butasi_revenue_expr,
        butasi_date_column
      )
      into butasi_revenue
      using target_date;
    end if;
  end if;

  insert into public.tenant_metrics_daily (
    date,
    total_tenants,
    total_parcele,
    total_recoltari,
    total_vanzari,
    total_kg_cal1,
    total_kg_cal2,
    total_revenue_lei,
    updated_at
  )
  values (
    target_date,
    (
      select count(distinct tenant_id)::int
      from (
        select r.tenant_id from public.recoltari r where r.data = target_date
        union all
        select v.tenant_id from public.vanzari v where v.data = target_date
        union all
        select a.tenant_id from public.activitati_agricole a where a.data_aplicare = target_date
      ) active_tenants
      where tenant_id is not null
    ),
    (
      select count(*)::int
      from public.parcele p
      where p.tenant_id is not null
    ),
    (
      select count(*)::int
      from public.recoltari r
      where r.data = target_date
    ),
    (
      select count(*)::int
      from public.vanzari v
      where v.data = target_date
    ),
    (
      select coalesce(sum(coalesce(r.kg_cal1, 0)), 0)
      from public.recoltari r
      where r.data = target_date
    ),
    (
      select coalesce(sum(coalesce(r.kg_cal2, 0)), 0)
      from public.recoltari r
      where r.data = target_date
    ),
    (
      coalesce((
        select sum(coalesce(v.cantitate_kg, 0) * coalesce(v.pret_lei_kg, 0))
        from public.vanzari v
        where v.data = target_date
      ), 0) + coalesce(butasi_revenue, 0)
    ),
    now()
  )
  on conflict (date)
  do update set
    total_tenants = excluded.total_tenants,
    total_parcele = excluded.total_parcele,
    total_recoltari = excluded.total_recoltari,
    total_vanzari = excluded.total_vanzari,
    total_kg_cal1 = excluded.total_kg_cal1,
    total_kg_cal2 = excluded.total_kg_cal2,
    total_revenue_lei = excluded.total_revenue_lei,
    updated_at = now()
  returning * into metrics_row;

  return metrics_row;
end;
$$;

grant execute on function public.refresh_tenant_metrics_daily(date) to authenticated;
grant execute on function public.refresh_tenant_metrics_daily(date) to service_role;

-- Seed one row for current day so admin analytics has baseline data
select public.refresh_tenant_metrics_daily(current_date);

select pg_notify('pgrst', 'reload schema');
