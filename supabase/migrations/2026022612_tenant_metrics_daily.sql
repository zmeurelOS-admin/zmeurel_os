-- Global anonymized admin analytics (aggregated, no tenant-identifiable data)

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

create index if not exists tenant_metrics_daily_date_desc_idx
  on public.tenant_metrics_daily (date desc);

alter table public.tenant_metrics_daily enable row level security;

drop policy if exists tenant_metrics_daily_superadmin_select on public.tenant_metrics_daily;
create policy tenant_metrics_daily_superadmin_select
on public.tenant_metrics_daily
for select
using (public.is_superadmin());

drop policy if exists tenant_metrics_daily_superadmin_insert on public.tenant_metrics_daily;
create policy tenant_metrics_daily_superadmin_insert
on public.tenant_metrics_daily
for insert
with check (public.is_superadmin());

drop policy if exists tenant_metrics_daily_superadmin_update on public.tenant_metrics_daily;
create policy tenant_metrics_daily_superadmin_update
on public.tenant_metrics_daily
for update
using (public.is_superadmin())
with check (public.is_superadmin());

drop policy if exists tenant_metrics_daily_superadmin_delete on public.tenant_metrics_daily;
create policy tenant_metrics_daily_superadmin_delete
on public.tenant_metrics_daily
for delete
using (public.is_superadmin());

create or replace function public.refresh_tenant_metrics_daily(p_date date default current_date)
returns public.tenant_metrics_daily
language plpgsql
security definer
set search_path = public
as $$
declare
  target_date date := coalesce(p_date, current_date);
  metrics_row public.tenant_metrics_daily;
begin
  if auth.uid() is not null and not public.is_superadmin(auth.uid()) then
    raise exception 'FORBIDDEN';
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
      ), 0)
      +
      coalesce((
        select sum(coalesce(vb.cantitate_butasi, 0) * coalesce(vb.pret_unitar_lei, 0))
        from public.vanzari_butasi vb
        where vb.data = target_date
      ), 0)
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

-- seed today snapshot once migration is applied
select public.refresh_tenant_metrics_daily(current_date);

notify pgrst, 'reload schema';
