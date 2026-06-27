
create table if not exists public.stock_reservations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  source_type text not null check (source_type in ('comanda', 'shop_order')),
  comanda_id uuid references public.comenzi(id) on delete set null,
  shop_order_id uuid references public.shop_orders(id) on delete set null,
  locatie_id uuid references public.parcele(id) on delete set null,
  produs text not null default 'zmeura',
  depozit text not null default 'fresh',
  calitate text not null default 'cal1' check (calitate = 'cal1'),
  cantitate_kg numeric not null check (cantitate_kg > 0),
  status text not null default 'active' check (status in ('active', 'released', 'consumed')),
  reserved_at timestamptz not null default now(),
  released_at timestamptz,
  consumed_at timestamptz,
  linked_vanzare_id uuid references public.vanzari(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  constraint stock_reservations_source_ref_check check (
    (source_type = 'comanda' and comanda_id is not null)
    or (source_type = 'shop_order' and shop_order_id is not null)
  ),
  constraint stock_reservations_depozit_check check (depozit in ('fresh', 'congelat', 'procesat'))
);

create index if not exists stock_reservations_tenant_status_idx on public.stock_reservations (tenant_id, status);
create index if not exists stock_reservations_comanda_id_idx on public.stock_reservations (comanda_id);
create index if not exists stock_reservations_shop_order_id_idx on public.stock_reservations (shop_order_id);

alter table public.stock_reservations enable row level security;

drop policy if exists stock_reservations_select on public.stock_reservations;
create policy stock_reservations_select on public.stock_reservations
  for select to authenticated using (tenant_id = public.current_tenant_id());

drop policy if exists stock_reservations_insert on public.stock_reservations;
create policy stock_reservations_insert on public.stock_reservations
  for insert to authenticated with check (
    tenant_id = public.current_tenant_id() and (public.is_tenant_owner(tenant_id) or public.operator_can_write('comenzi'))
  );

drop policy if exists stock_reservations_update on public.stock_reservations;
create policy stock_reservations_update on public.stock_reservations
  for update to authenticated using (
    tenant_id = public.current_tenant_id() and (public.is_tenant_owner(tenant_id) or public.operator_can_write('comenzi'))
  ) with check (
    tenant_id = public.current_tenant_id() and (public.is_tenant_owner(tenant_id) or public.operator_can_write('comenzi'))
  );

drop policy if exists stock_reservations_delete on public.stock_reservations;
create policy stock_reservations_delete on public.stock_reservations
  for delete to authenticated using (
    tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id)
  );
;
