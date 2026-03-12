create extension if not exists pgcrypto;

alter table public.clienti
  add column if not exists google_resource_name text,
  add column if not exists google_etag text;

create unique index if not exists clienti_tenant_google_resource_name_uq
  on public.clienti (tenant_id, google_resource_name)
  where google_resource_name is not null;

create table if not exists public.integrations_google_contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text not null,
  connected_email text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  scope text,
  sync_token text,
  sync_enabled boolean not null default true,
  sync_window text not null default 'seara' check (sync_window in ('dimineata', 'seara')),
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create or replace function public.integrations_google_contacts_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_integrations_google_contacts_updated_at on public.integrations_google_contacts;
create trigger trg_integrations_google_contacts_updated_at
before update on public.integrations_google_contacts
for each row
execute function public.integrations_google_contacts_set_updated_at();

alter table public.integrations_google_contacts enable row level security;

drop policy if exists integrations_google_contacts_admin_select on public.integrations_google_contacts;
create policy integrations_google_contacts_admin_select
on public.integrations_google_contacts
for select
using (
  user_email = 'popa.andrei.sv@gmail.com'
  and auth.uid() = user_id
);

drop policy if exists integrations_google_contacts_admin_insert on public.integrations_google_contacts;
create policy integrations_google_contacts_admin_insert
on public.integrations_google_contacts
for insert
with check (
  user_email = 'popa.andrei.sv@gmail.com'
  and auth.uid() = user_id
  and tenant_id = (
    select id
    from public.tenants
    where owner_user_id = auth.uid()
    limit 1
  )
);

drop policy if exists integrations_google_contacts_admin_update on public.integrations_google_contacts;
create policy integrations_google_contacts_admin_update
on public.integrations_google_contacts
for update
using (
  user_email = 'popa.andrei.sv@gmail.com'
  and auth.uid() = user_id
)
with check (
  user_email = 'popa.andrei.sv@gmail.com'
  and auth.uid() = user_id
  and tenant_id = (
    select id
    from public.tenants
    where owner_user_id = auth.uid()
    limit 1
  )
);

drop policy if exists integrations_google_contacts_admin_delete on public.integrations_google_contacts;
create policy integrations_google_contacts_admin_delete
on public.integrations_google_contacts
for delete
using (
  user_email = 'popa.andrei.sv@gmail.com'
  and auth.uid() = user_id
);

notify pgrst, 'reload schema';
