do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'comanda_status'
  ) then
    create type public.comanda_status as enum (
      'noua',
      'confirmata',
      'programata',
      'in_livrare',
      'livrata',
      'anulata'
    );
  end if;
end
$$;

create table if not exists public.comenzi (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid references public.clienti(id) on delete set null,
  client_nume_manual text,
  telefon text,
  locatie_livrare text,
  data_comanda date not null default current_date,
  data_livrare date,
  cantitate_kg numeric not null check (cantitate_kg > 0),
  pret_per_kg numeric not null check (pret_per_kg > 0),
  total numeric not null default 0 check (total >= 0),
  status public.comanda_status not null default 'noua',
  observatii text,
  linked_vanzare_id uuid references public.vanzari(id) on delete set null,
  parent_comanda_id uuid references public.comenzi(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists comenzi_tenant_idx on public.comenzi (tenant_id);
create index if not exists comenzi_status_idx on public.comenzi (tenant_id, status);
create index if not exists comenzi_data_livrare_idx on public.comenzi (tenant_id, data_livrare);
create index if not exists comenzi_client_idx on public.comenzi (tenant_id, client_id);

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
