-- Ensure public.comenzi exists and is visible in PostgREST schema cache.
-- Idempotent: safe if table/policies already exist.

create table if not exists public.comenzi (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid null references public.clienti(id) on delete set null,
  client_nume_manual text null,
  telefon text,
  locatie_livrare text,
  data_comanda date not null default current_date,
  data_livrare date not null,
  cantitate_kg numeric not null,
  pret_per_kg numeric not null,
  total numeric not null,
  status text not null,
  observatii text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep compatibility with previous module revision if table already existed.
alter table public.comenzi
  add column if not exists client_nume_manual text null,
  add column if not exists observatii text null,
  add column if not exists telefon text,
  add column if not exists locatie_livrare text,
  add column if not exists total numeric not null default 0,
  add column if not exists status text not null default 'noua';

-- If a previous enum-based schema exists, normalize to text + check constraint.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'comenzi'
      and column_name = 'status'
      and udt_name = 'comanda_status'
  ) then
    alter table public.comenzi
      alter column status type text using status::text;
  end if;
end
$$;

-- Enforce requested status domain.
alter table public.comenzi
  drop constraint if exists comenzi_status_check;

alter table public.comenzi
  add constraint comenzi_status_check
  check (status in ('noua', 'confirmata', 'programata', 'in_livrare', 'livrata', 'anulata'));

-- Ensure non-null delivery date and numeric guards.
update public.comenzi
set data_livrare = coalesce(data_livrare, current_date)
where data_livrare is null;

alter table public.comenzi
  alter column data_livrare set not null;

alter table public.comenzi
  drop constraint if exists comenzi_cantitate_positive_check;

alter table public.comenzi
  add constraint comenzi_cantitate_positive_check check (cantitate_kg > 0);

alter table public.comenzi
  drop constraint if exists comenzi_pret_positive_check;

alter table public.comenzi
  add constraint comenzi_pret_positive_check check (pret_per_kg > 0);

alter table public.comenzi
  drop constraint if exists comenzi_total_non_negative_check;

alter table public.comenzi
  add constraint comenzi_total_non_negative_check check (total >= 0);

create index if not exists comenzi_tenant_idx on public.comenzi (tenant_id);
create index if not exists comenzi_data_livrare_idx on public.comenzi (tenant_id, data_livrare);
create index if not exists comenzi_status_idx on public.comenzi (tenant_id, status);

create or replace function public.set_comenzi_tenant_and_audit()
returns trigger
language plpgsql
security definer
as $$
declare
  resolved_tenant uuid;
begin
  if tg_op = 'INSERT' then
    if new.tenant_id is null then
      select t.id
      into resolved_tenant
      from public.tenants t
      where t.owner_user_id = auth.uid()
      limit 1;

      new.tenant_id := resolved_tenant;
    end if;

    new.created_at := coalesce(new.created_at, now());
  end if;

  new.updated_at := now();
  new.total := round((coalesce(new.cantitate_kg, 0) * coalesce(new.pret_per_kg, 0))::numeric, 2);
  return new;
end;
$$;

drop trigger if exists comenzi_set_tenant_and_audit on public.comenzi;
create trigger comenzi_set_tenant_and_audit
before insert or update on public.comenzi
for each row execute function public.set_comenzi_tenant_and_audit();

alter table public.comenzi enable row level security;

drop policy if exists comenzi_tenant_select on public.comenzi;
create policy comenzi_tenant_select
on public.comenzi
for select
using (
  tenant_id = (
    select id
    from public.tenants
    where owner_user_id = auth.uid()
    limit 1
  )
);

drop policy if exists comenzi_tenant_insert on public.comenzi;
create policy comenzi_tenant_insert
on public.comenzi
for insert
with check (
  tenant_id = (
    select id
    from public.tenants
    where owner_user_id = auth.uid()
    limit 1
  )
);

drop policy if exists comenzi_tenant_update on public.comenzi;
create policy comenzi_tenant_update
on public.comenzi
for update
using (
  tenant_id = (
    select id
    from public.tenants
    where owner_user_id = auth.uid()
    limit 1
  )
)
with check (
  tenant_id = (
    select id
    from public.tenants
    where owner_user_id = auth.uid()
    limit 1
  )
);

drop policy if exists comenzi_tenant_delete on public.comenzi;
create policy comenzi_tenant_delete
on public.comenzi
for delete
using (
  tenant_id = (
    select id
    from public.tenants
    where owner_user_id = auth.uid()
    limit 1
  )
);

notify pgrst, 'reload schema';
