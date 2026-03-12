-- Global cumulative stock on top of existing miscari_stoc table.
-- Backward-compatible with existing location-based inventory usage.

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'miscare_stoc_tip_global'
  ) then
    create type public.miscare_stoc_tip_global as enum (
      'recoltare',
      'ajustare',
      'vanzare',
      'transformare',
      'corectie'
    );
  end if;
end
$$;

create table if not exists public.miscari_stoc (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  tip public.miscare_stoc_tip_global,
  data date not null default current_date,
  cantitate_cal1 numeric not null default 0,
  cantitate_cal2 numeric not null default 0,
  referinta_id uuid null,
  descriere text null,
  created_at timestamptz not null default now()
);

alter table public.miscari_stoc
  add column if not exists tip public.miscare_stoc_tip_global,
  add column if not exists cantitate_cal1 numeric not null default 0,
  add column if not exists cantitate_cal2 numeric not null default 0,
  add column if not exists descriere text null;

-- Allow global (non-location) movements while keeping old schema usable.
alter table public.miscari_stoc
  alter column locatie_id drop not null,
  alter column produs drop not null,
  alter column calitate drop not null,
  alter column depozit drop not null,
  alter column tip_miscare drop not null,
  alter column cantitate_kg drop not null;

create index if not exists miscari_stoc_tenant_tip_data_idx
  on public.miscari_stoc (tenant_id, tip, data);

alter table public.miscari_stoc enable row level security;

notify pgrst, 'reload schema';
