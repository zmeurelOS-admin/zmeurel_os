create extension if not exists pgcrypto;

alter table public.vanzari_butasi
  add column if not exists data_comanda date not null default current_date,
  add column if not exists data_livrare_estimata date,
  add column if not exists status text not null default 'noua',
  add column if not exists adresa_livrare text,
  add column if not exists avans_suma numeric not null default 0,
  add column if not exists avans_data date,
  add column if not exists total_lei numeric not null default 0;

update public.vanzari_butasi
set
  data_comanda = coalesce(data_comanda, data, current_date),
  total_lei = coalesce(total_lei, (coalesce(cantitate_butasi, 0)::numeric * coalesce(pret_unitar_lei, 0)::numeric), 0),
  status = coalesce(nullif(status, ''), 'noua'),
  avans_suma = coalesce(avans_suma, 0)
where true;

create table if not exists public.vanzari_butasi_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  comanda_id uuid not null references public.vanzari_butasi(id) on delete cascade,
  soi text not null,
  cantitate integer not null check (cantitate > 0),
  pret_unitar numeric not null check (pret_unitar > 0),
  subtotal numeric not null check (subtotal > 0),
  created_at timestamptz not null default now()
);

create index if not exists vanzari_butasi_items_comanda_id_idx
  on public.vanzari_butasi_items (comanda_id);

create index if not exists vanzari_butasi_items_tenant_id_idx
  on public.vanzari_butasi_items (tenant_id);

insert into public.vanzari_butasi_items (
  tenant_id,
  comanda_id,
  soi,
  cantitate,
  pret_unitar,
  subtotal
)
select
  vb.tenant_id,
  vb.id,
  coalesce(nullif(vb.soi_butasi, ''), 'Necunoscut'),
  greatest(vb.cantitate_butasi, 1),
  greatest(vb.pret_unitar_lei::numeric, 0.01),
  greatest(vb.cantitate_butasi, 1)::numeric * greatest(vb.pret_unitar_lei::numeric, 0.01)
from public.vanzari_butasi vb
where vb.tenant_id is not null
  and not exists (
    select 1
    from public.vanzari_butasi_items it
    where it.comanda_id = vb.id
  );

create or replace function public.enforce_vanzari_butasi_items_tenant()
returns trigger
language plpgsql
security definer
as $$
declare
  order_tenant uuid;
begin
  select tenant_id
  into order_tenant
  from public.vanzari_butasi
  where id = new.comanda_id;

  if order_tenant is null then
    raise exception 'Comanda invalida sau fara tenant';
  end if;

  if new.tenant_id is null then
    new.tenant_id := order_tenant;
  end if;

  if new.tenant_id <> order_tenant then
    raise exception 'tenant_id din item trebuie sa corespunda comenzii';
  end if;

  return new;
end;
$$;

drop trigger if exists vanzari_butasi_items_enforce_tenant on public.vanzari_butasi_items;
create trigger vanzari_butasi_items_enforce_tenant
before insert or update on public.vanzari_butasi_items
for each row
execute function public.enforce_vanzari_butasi_items_tenant();

alter table public.vanzari_butasi_items enable row level security;

drop policy if exists vanzari_butasi_items_tenant_select on public.vanzari_butasi_items;
create policy vanzari_butasi_items_tenant_select
on public.vanzari_butasi_items
for select
using (
  tenant_id = (
    select id
    from public.tenants
    where owner_user_id = auth.uid()
    limit 1
  )
);

drop policy if exists vanzari_butasi_items_tenant_insert on public.vanzari_butasi_items;
create policy vanzari_butasi_items_tenant_insert
on public.vanzari_butasi_items
for insert
with check (
  tenant_id = (
    select id
    from public.tenants
    where owner_user_id = auth.uid()
    limit 1
  )
  and exists (
    select 1
    from public.vanzari_butasi vb
    where vb.id = comanda_id
      and vb.tenant_id = vanzari_butasi_items.tenant_id
  )
);

drop policy if exists vanzari_butasi_items_tenant_update on public.vanzari_butasi_items;
create policy vanzari_butasi_items_tenant_update
on public.vanzari_butasi_items
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
  and exists (
    select 1
    from public.vanzari_butasi vb
    where vb.id = comanda_id
      and vb.tenant_id = vanzari_butasi_items.tenant_id
  )
);

drop policy if exists vanzari_butasi_items_tenant_delete on public.vanzari_butasi_items;
create policy vanzari_butasi_items_tenant_delete
on public.vanzari_butasi_items
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
