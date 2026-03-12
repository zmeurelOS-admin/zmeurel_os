create extension if not exists pgcrypto;

-- ===============================
-- Schema updates
-- ===============================

alter table public.recoltari
  add column if not exists client_sync_id uuid,
  add column if not exists sync_status text default 'synced',
  add column if not exists created_by uuid,
  add column if not exists updated_by uuid,
  add column if not exists updated_at timestamptz default now();

alter table public.vanzari
  add column if not exists client_sync_id uuid,
  add column if not exists sync_status text default 'synced',
  add column if not exists created_by uuid,
  add column if not exists updated_by uuid,
  add column if not exists updated_at timestamptz default now();

alter table public.activitati_agricole
  add column if not exists client_sync_id uuid,
  add column if not exists sync_status text default 'synced',
  add column if not exists created_by uuid,
  add column if not exists updated_by uuid,
  add column if not exists updated_at timestamptz default now();

alter table public.cheltuieli_diverse
  add column if not exists client_sync_id uuid,
  add column if not exists sync_status text default 'synced',
  add column if not exists created_by uuid,
  add column if not exists updated_by uuid,
  add column if not exists updated_at timestamptz default now();

update public.recoltari set client_sync_id = gen_random_uuid() where client_sync_id is null;
update public.vanzari set client_sync_id = gen_random_uuid() where client_sync_id is null;
update public.activitati_agricole set client_sync_id = gen_random_uuid() where client_sync_id is null;
update public.cheltuieli_diverse set client_sync_id = gen_random_uuid() where client_sync_id is null;

alter table public.recoltari alter column client_sync_id set not null;
alter table public.vanzari alter column client_sync_id set not null;
alter table public.activitati_agricole alter column client_sync_id set not null;
alter table public.cheltuieli_diverse alter column client_sync_id set not null;

create unique index if not exists recoltari_client_sync_id_uq on public.recoltari (client_sync_id);
create unique index if not exists vanzari_client_sync_id_uq on public.vanzari (client_sync_id);
create unique index if not exists activitati_agricole_client_sync_id_uq on public.activitati_agricole (client_sync_id);
create unique index if not exists cheltuieli_diverse_client_sync_id_uq on public.cheltuieli_diverse (client_sync_id);

-- ===============================
-- Audit + sync safety trigger
-- ===============================

create or replace function public.set_sync_audit_fields()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.client_sync_id is null then
    new.client_sync_id := gen_random_uuid();
  end if;

  if new.sync_status is null then
    new.sync_status := 'synced';
  end if;

  if tg_op = 'INSERT' then
    if new.created_by is null then
      new.created_by := auth.uid();
    end if;
    if new.updated_by is null then
      new.updated_by := coalesce(auth.uid(), new.created_by);
    end if;
  else
    new.updated_by := coalesce(auth.uid(), new.updated_by);
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists recoltari_set_sync_audit_fields on public.recoltari;
create trigger recoltari_set_sync_audit_fields
before insert or update on public.recoltari
for each row execute function public.set_sync_audit_fields();

drop trigger if exists vanzari_set_sync_audit_fields on public.vanzari;
create trigger vanzari_set_sync_audit_fields
before insert or update on public.vanzari
for each row execute function public.set_sync_audit_fields();

drop trigger if exists activitati_agricole_set_sync_audit_fields on public.activitati_agricole;
create trigger activitati_agricole_set_sync_audit_fields
before insert or update on public.activitati_agricole
for each row execute function public.set_sync_audit_fields();

drop trigger if exists cheltuieli_diverse_set_sync_audit_fields on public.cheltuieli_diverse;
create trigger cheltuieli_diverse_set_sync_audit_fields
before insert or update on public.cheltuieli_diverse
for each row execute function public.set_sync_audit_fields();

-- ===============================
-- RLS policies
-- ===============================

alter table public.recoltari enable row level security;
alter table public.vanzari enable row level security;
alter table public.activitati_agricole enable row level security;
alter table public.cheltuieli_diverse enable row level security;

drop policy if exists recoltari_owner_update on public.recoltari;
create policy recoltari_owner_update
on public.recoltari
for update
using (
  tenant_id = (select id from public.tenants where owner_user_id = auth.uid())
  and coalesce(created_by, auth.uid()) = auth.uid()
)
with check (
  tenant_id = (select id from public.tenants where owner_user_id = auth.uid())
  and coalesce(created_by, auth.uid()) = auth.uid()
);

drop policy if exists vanzari_owner_update on public.vanzari;
create policy vanzari_owner_update
on public.vanzari
for update
using (
  tenant_id = (select id from public.tenants where owner_user_id = auth.uid())
  and coalesce(created_by, auth.uid()) = auth.uid()
)
with check (
  tenant_id = (select id from public.tenants where owner_user_id = auth.uid())
  and coalesce(created_by, auth.uid()) = auth.uid()
);

drop policy if exists activitati_agricole_owner_update on public.activitati_agricole;
create policy activitati_agricole_owner_update
on public.activitati_agricole
for update
using (
  tenant_id = (select id from public.tenants where owner_user_id = auth.uid())
  and coalesce(created_by, auth.uid()) = auth.uid()
)
with check (
  tenant_id = (select id from public.tenants where owner_user_id = auth.uid())
  and coalesce(created_by, auth.uid()) = auth.uid()
);

drop policy if exists cheltuieli_diverse_owner_update on public.cheltuieli_diverse;
create policy cheltuieli_diverse_owner_update
on public.cheltuieli_diverse
for update
using (
  tenant_id = (select id from public.tenants where owner_user_id = auth.uid())
  and coalesce(created_by, auth.uid()) = auth.uid()
)
with check (
  tenant_id = (select id from public.tenants where owner_user_id = auth.uid())
  and coalesce(created_by, auth.uid()) = auth.uid()
);

-- ===============================
-- Generic idempotent upsert helper
-- ===============================

create or replace function public.upsert_with_idempotency(table_name text, payload jsonb)
returns jsonb
language plpgsql
security definer
as $$
declare
  result jsonb;
begin
  if table_name not in ('recoltari', 'vanzari', 'activitati_agricole', 'cheltuieli_diverse') then
    raise exception 'Unsupported table: %', table_name;
  end if;

  execute format(
    'with upserted as (
      insert into public.%1$I as t
      select * from jsonb_populate_record(null::public.%1$I, $1)
      on conflict (client_sync_id)
      do update
      set sync_status = coalesce(excluded.sync_status, t.sync_status),
          updated_by = coalesce(excluded.updated_by, auth.uid(), t.updated_by),
          updated_at = now()
      returning t.*
    )
    select to_jsonb(upserted) from upserted',
    table_name
  )
  into result
  using payload;

  return result;
end;
$$;
