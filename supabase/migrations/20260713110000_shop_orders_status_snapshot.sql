-- Faza 2B: `comenzi` este sursa canonică pentru dashboard.
-- `shop_orders` rămâne intake/snapshot pentru checkout-ul public și este oglindit
-- din bridge-ul ERP după fiecare tranziție de status efectuată pe `comenzi`.

alter table public.shop_orders
  drop constraint if exists shop_orders_status_check;

alter table public.shop_orders
  add constraint shop_orders_status_check check (
    status in ('noua', 'confirmata', 'programata', 'in_livrare', 'livrata', 'anulata')
  );

create or replace function public.validate_shop_order_status_transition()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if old.status = 'anulata' then
    raise exception 'invalid_status_transition'
      using hint = 'Nu se poate modifica o comandă anulată.';
  end if;

  if old.status = 'livrata' and new.status not in ('confirmata', 'programata') then
    raise exception 'invalid_status_transition'
      using hint = 'Redeschiderea unei comenzi livrate revine la confirmată sau programată.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_shop_order_status on public.shop_orders;
create trigger validate_shop_order_status
  before update of status on public.shop_orders
  for each row
  execute function public.validate_shop_order_status_transition();

create or replace function public.sync_shop_order_status_from_comanda()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.data_origin is distinct from 'shop_order_bridge'
     or new.status is not distinct from old.status then
    return new;
  end if;

  update public.shop_orders as shop_order
  set status = new.status
  from public.shop_order_erp_links as link
  where link.comanda_id = new.id
    and link.tenant_id = new.tenant_id
    and shop_order.id = link.shop_order_id
    and shop_order.tenant_id = new.tenant_id
    and shop_order.status is distinct from new.status;

  return new;
end;
$$;

drop trigger if exists sync_shop_order_status_from_comanda on public.comenzi;
create trigger sync_shop_order_status_from_comanda
  after update of status on public.comenzi
  for each row
  execute function public.sync_shop_order_status_from_comanda();

comment on function public.sync_shop_order_status_from_comanda() is
  'Menține shop_orders.status ca snapshot al intake-ului. Dashboard-ul citește exclusiv public.comenzi.';
