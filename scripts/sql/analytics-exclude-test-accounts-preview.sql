-- DRY RUN / audit (read-only): candidați marcați de migrarea 20260402100000_analytics_exclude_test_accounts.sql
-- Criteriu: email *@example.test — același pattern folosit în toate fișierele e2e din repo.
-- Nu execută UPDATE; rulează în Supabase SQL Editor sau psql.

select p.id as profile_id, u.email, p.tenant_id, t.nume_ferma, t.is_demo
from public.profiles p
join auth.users u on u.id = p.id
left join public.tenants t on t.id = p.tenant_id
where lower(u.email) like '%@example.test'
order by u.email;

select t.id, t.nume_ferma, t.is_demo, t.owner_user_id
from public.tenants t
where exists (
  select 1 from public.profiles p
  join auth.users u on u.id = p.id
  where p.tenant_id = t.id and lower(u.email) like '%@example.test'
)
or exists (
  select 1 from auth.users uo
  where uo.id = t.owner_user_id and lower(uo.email) like '%@example.test'
)
order by t.created_at desc nulls last;

-- Opțional: volume analytics_events pentru tenanți excluși (doar raportare, înainte de migrare)
-- select e.tenant_id, count(*) as events
-- from public.analytics_events e
-- join public.tenants t on t.id = e.tenant_id
-- where t.exclude_from_analytics = true
-- group by e.tenant_id;
