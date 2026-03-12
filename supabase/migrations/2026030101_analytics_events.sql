create extension if not exists pgcrypto;

create table if not exists public.analytics_events (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid references public.tenants(id) on delete cascade,
  user_id uuid,
  event_name text not null,
  event_data jsonb default '{}'::jsonb,
  page_url text,
  created_at timestamptz default now()
);

alter table public.analytics_events
  add column if not exists event_data jsonb default '{}'::jsonb;

alter table public.analytics_events
  add column if not exists page_url text;

alter table public.analytics_events enable row level security;

drop policy if exists "Users can insert own events" on public.analytics_events;
drop policy if exists analytics_events_insert_own_tenant on public.analytics_events;
create policy "Users can insert own events"
on public.analytics_events
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.tenants t
    where t.id = analytics_events.tenant_id
      and t.owner_user_id = auth.uid()
  )
);

drop policy if exists "Superadmin can read all" on public.analytics_events;
drop policy if exists analytics_events_no_read_for_tenant_users on public.analytics_events;
create policy "Superadmin can read all"
on public.analytics_events
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_superadmin = true
  )
);

create index if not exists idx_analytics_events_tenant
  on public.analytics_events(tenant_id, created_at desc);

create index if not exists idx_analytics_events_name
  on public.analytics_events(event_name, created_at desc);
