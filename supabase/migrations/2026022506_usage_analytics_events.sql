create extension if not exists pgcrypto;

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_tenant_id_idx
  on public.analytics_events (tenant_id);

create index if not exists analytics_events_event_name_idx
  on public.analytics_events (event_name);

create index if not exists analytics_events_created_at_idx
  on public.analytics_events (created_at desc);

create or replace function public.set_analytics_event_context()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;

  if new.tenant_id is null then
    select t.id into new.tenant_id
    from public.tenants t
    where t.owner_user_id = auth.uid()
    limit 1;
  end if;

  if new.metadata is null then
    new.metadata := '{}'::jsonb;
  end if;

  if new.created_at is null then
    new.created_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists analytics_events_set_context on public.analytics_events;
create trigger analytics_events_set_context
before insert on public.analytics_events
for each row execute function public.set_analytics_event_context();

alter table public.analytics_events enable row level security;

drop policy if exists analytics_events_insert_own_tenant on public.analytics_events;
create policy analytics_events_insert_own_tenant
on public.analytics_events
for insert
with check (
  user_id = auth.uid()
  and tenant_id = (
    select id
    from public.tenants
    where owner_user_id = auth.uid()
    limit 1
  )
);

drop policy if exists analytics_events_no_read_for_tenant_users on public.analytics_events;
create policy analytics_events_no_read_for_tenant_users
on public.analytics_events
for select
using (auth.role() = 'service_role');

