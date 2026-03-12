-- Harden cheltuieli_diverse schema for offline/idempotent writes.
create extension if not exists pgcrypto;

alter table public.cheltuieli_diverse
  add column if not exists client_sync_id uuid,
  add column if not exists sync_status text default 'synced',
  add column if not exists conflict_flag boolean default false,
  add column if not exists created_by uuid,
  add column if not exists updated_by uuid;

update public.cheltuieli_diverse
set client_sync_id = gen_random_uuid()
where client_sync_id is null;

alter table public.cheltuieli_diverse
  alter column client_sync_id set default gen_random_uuid();

create unique index if not exists cheltuieli_diverse_client_sync_id_uq
  on public.cheltuieli_diverse (tenant_id, client_sync_id)
  where client_sync_id is not null;

-- Force PostgREST schema cache reload.
notify pgrst, 'reload schema';
