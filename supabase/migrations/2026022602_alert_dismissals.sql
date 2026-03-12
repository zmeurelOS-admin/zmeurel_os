-- Smart Alerts dismissals (snooze for current Bucharest day)

create extension if not exists pgcrypto;

create or replace function public.bucharest_today()
returns date
language sql
stable
as $$
  select (now() at time zone 'Europe/Bucharest')::date
$$;

grant execute on function public.bucharest_today() to authenticated;
grant execute on function public.bucharest_today() to service_role;

create table if not exists public.alert_dismissals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  alert_key text not null,
  dismissed_on date not null default public.bucharest_today(),
  created_at timestamptz not null default now(),
  constraint alert_dismissals_unique_per_day unique (tenant_id, user_id, alert_key, dismissed_on)
);

create index if not exists alert_dismissals_tenant_user_day_idx
  on public.alert_dismissals (tenant_id, user_id, dismissed_on);

create index if not exists alert_dismissals_tenant_user_key_idx
  on public.alert_dismissals (tenant_id, user_id, alert_key);

alter table public.alert_dismissals enable row level security;

drop policy if exists alert_dismissals_select_own on public.alert_dismissals;
create policy alert_dismissals_select_own
on public.alert_dismissals
for select
using (
  (
    user_id = auth.uid()
    and tenant_id = (
      select t.id
      from public.tenants t
      where t.owner_user_id = auth.uid()
      limit 1
    )
  )
  or public.is_superadmin(auth.uid())
);

drop policy if exists alert_dismissals_insert_own on public.alert_dismissals;
create policy alert_dismissals_insert_own
on public.alert_dismissals
for insert
with check (
  user_id = auth.uid()
  and tenant_id = (
    select t.id
    from public.tenants t
    where t.owner_user_id = auth.uid()
    limit 1
  )
);

drop policy if exists alert_dismissals_delete_own on public.alert_dismissals;
create policy alert_dismissals_delete_own
on public.alert_dismissals
for delete
using (
  user_id = auth.uid()
  and tenant_id = (
    select t.id
    from public.tenants t
    where t.owner_user_id = auth.uid()
    limit 1
  )
);

select pg_notify('pgrst', 'reload schema');

