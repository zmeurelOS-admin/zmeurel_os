-- Analytics hygiene: mark conturi folosite exclusiv în E2E (email *@example.test din repo Playwright) ca excluse
-- din KPI-uri admin + agregarea zilnică. Reversibil: UPDATE ... SET exclude_from_analytics = false.

alter table public.profiles
  add column if not exists exclude_from_analytics boolean not null default false;

alter table public.tenants
  add column if not exists exclude_from_analytics boolean not null default false;

comment on column public.profiles.exclude_from_analytics is
  'True = exclus din KPI-urile admin analytics (ex. E2E: *@example.test). Nu afectează RLS sau operațiuni ERP.';
comment on column public.tenants.exclude_from_analytics is
  'True = fermă exclusă din KPI-uri admin + refresh_tenant_metrics_daily. Reversibil.';

create index if not exists profiles_exclude_from_analytics_idx
  on public.profiles (exclude_from_analytics)
  where exclude_from_analytics = true;

create index if not exists tenants_exclude_from_analytics_idx
  on public.tenants (exclude_from_analytics)
  where exclude_from_analytics = true;

-- Sursă verificabilă: toate testele Playwright din repo folosesc suffix @example.test
update public.profiles p
set exclude_from_analytics = true
from auth.users u
where u.id = p.id
  and lower(u.email) like '%@example.test';

update public.tenants t
set exclude_from_analytics = true
where exists (
  select 1 from public.profiles p
  where p.tenant_id = t.id and p.exclude_from_analytics = true
)
or exists (
  select 1 from public.profiles p
  where p.id = t.owner_user_id and p.exclude_from_analytics = true
);

-- Agregare zilnică: exclude operațiuni parcele/recoltări/vânzări ai fermelor marcate
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
      select count(distinct x.tenant_id)::int
      from (
        select r.tenant_id from public.recoltari r
        inner join public.tenants te on te.id = r.tenant_id and te.exclude_from_analytics = false
        where r.data = target_date
        union all
        select v.tenant_id from public.vanzari v
        inner join public.tenants te on te.id = v.tenant_id and te.exclude_from_analytics = false
        where v.data = target_date
        union all
        select a.tenant_id from public.activitati_agricole a
        inner join public.tenants te on te.id = a.tenant_id and te.exclude_from_analytics = false
        where a.data_aplicare = target_date
      ) x
      where x.tenant_id is not null
    ),
    (
      select count(*)::int
      from public.parcele p
      inner join public.tenants te on te.id = p.tenant_id and te.exclude_from_analytics = false
      where p.tenant_id is not null
    ),
    (
      select count(*)::int
      from public.recoltari r
      inner join public.tenants te on te.id = r.tenant_id and te.exclude_from_analytics = false
      where r.data = target_date
    ),
    (
      select count(*)::int
      from public.vanzari v
      inner join public.tenants te on te.id = v.tenant_id and te.exclude_from_analytics = false
      where v.data = target_date
    ),
    (
      select coalesce(sum(coalesce(r.kg_cal1, 0)), 0)
      from public.recoltari r
      inner join public.tenants te on te.id = r.tenant_id and te.exclude_from_analytics = false
      where r.data = target_date
    ),
    (
      select coalesce(sum(coalesce(r.kg_cal2, 0)), 0)
      from public.recoltari r
      inner join public.tenants te on te.id = r.tenant_id and te.exclude_from_analytics = false
      where r.data = target_date
    ),
    (
      coalesce((
        select sum(coalesce(v.cantitate_kg, 0) * coalesce(v.pret_lei_kg, 0))
        from public.vanzari v
        inner join public.tenants te on te.id = v.tenant_id and te.exclude_from_analytics = false
        where v.data = target_date
      ), 0)
      +
      coalesce((
        select sum(coalesce(vb.cantitate_butasi, 0) * coalesce(vb.pret_unitar_lei, 0))
        from public.vanzari_butasi vb
        inner join public.tenants te on te.id = vb.tenant_id and te.exclude_from_analytics = false
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

notify pgrst, 'reload schema';

-- După aplicare: rândurile vechi din tenant_metrics_daily păstrează valorile istorice până la rerulare RPC pe acea dată.
-- Opțional (manual): pentru fiecare dată din ultimele N zile, `select refresh_tenant_metrics_daily('YYYY-MM-DD'::date);`
