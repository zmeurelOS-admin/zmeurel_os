-- Ensure client_sync_id exists consistently for offline/idempotent flows.
create extension if not exists pgcrypto;

alter table public.activitati_agricole
  add column if not exists client_sync_id uuid,
  add column if not exists sync_status text default 'synced',
  add column if not exists conflict_flag boolean default false;

alter table public.recoltari
  add column if not exists client_sync_id uuid,
  add column if not exists sync_status text default 'synced',
  add column if not exists conflict_flag boolean default false;

alter table public.vanzari
  add column if not exists client_sync_id uuid,
  add column if not exists sync_status text default 'synced',
  add column if not exists conflict_flag boolean default false;

alter table public.cheltuieli_diverse
  add column if not exists client_sync_id uuid,
  add column if not exists sync_status text default 'synced',
  add column if not exists conflict_flag boolean default false;

-- Backfill existing rows and keep insert compatibility.
update public.activitati_agricole
set client_sync_id = gen_random_uuid()
where client_sync_id is null;

update public.recoltari
set client_sync_id = gen_random_uuid()
where client_sync_id is null;

update public.vanzari
set client_sync_id = gen_random_uuid()
where client_sync_id is null;

update public.cheltuieli_diverse
set client_sync_id = gen_random_uuid()
where client_sync_id is null;

alter table public.activitati_agricole alter column client_sync_id set default gen_random_uuid();
alter table public.recoltari alter column client_sync_id set default gen_random_uuid();
alter table public.vanzari alter column client_sync_id set default gen_random_uuid();
alter table public.cheltuieli_diverse alter column client_sync_id set default gen_random_uuid();

create unique index if not exists activitati_agricole_client_sync_id_uq
  on public.activitati_agricole (client_sync_id);
create unique index if not exists recoltari_client_sync_id_uq
  on public.recoltari (client_sync_id);
create unique index if not exists vanzari_client_sync_id_uq
  on public.vanzari (client_sync_id);
create unique index if not exists cheltuieli_diverse_client_sync_id_uq
  on public.cheltuieli_diverse (client_sync_id);

-- Force PostgREST schema cache refresh in environments where needed.
notify pgrst, 'reload schema';
