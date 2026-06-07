-- Persistent daily delivery route for the public B2C shop.
-- This migration does not backfill or mutate existing rows.

alter table public.shop_orders
  add column if not exists delivery_date date,
  add column if not exists delivery_position integer;

create index if not exists shop_orders_delivery_route_idx
  on public.shop_orders (tenant_id, delivery_date, delivery_position);

create or replace function public.list_shop_orders_in_delivery_today()
returns setof public.shop_orders
language sql
stable
security definer
set search_path = public
as $$
  select shop_order.*
  from public.shop_orders shop_order
  where auth.uid() is not null
    and shop_order.tenant_id = public.current_tenant_id()
    and shop_order.status = 'in_livrare'
    and (
      shop_order.delivery_date = public.bucharest_today()
      or (
        shop_order.delivery_date is null
        and (shop_order.created_at at time zone 'Europe/Bucharest')::date = public.bucharest_today()
      )
    )
  order by shop_order.delivery_position asc nulls last, shop_order.created_at asc;
$$;

create or replace function public.reorder_shop_deliveries_today(
  p_order_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_today date := public.bucharest_today();
  v_expected_count integer;
  v_updated_count integer;
begin
  if auth.uid() is null then
    raise exception 'Neautorizat';
  end if;

  select public.current_tenant_id()
  into v_tenant_id;

  if v_tenant_id is null then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  if coalesce(array_length(p_order_ids, 1), 0) = 0 then
    raise exception 'Lista livrărilor este goală.';
  end if;

  if (
    select count(*)
    from unnest(p_order_ids) as requested(order_id)
  ) <> (
    select count(distinct order_id)
    from unnest(p_order_ids) as requested(order_id)
  ) then
    raise exception 'Lista livrărilor conține duplicate.';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('shop-delivery-reorder'),
    hashtext(v_tenant_id::text || ':' || v_today::text)
  );

  select count(*)
  into v_expected_count
  from public.shop_orders shop_order
  where shop_order.tenant_id = v_tenant_id
    and shop_order.status = 'in_livrare'
    and (
      shop_order.delivery_date = v_today
      or (
        shop_order.delivery_date is null
        and (shop_order.created_at at time zone 'Europe/Bucharest')::date = v_today
      )
    );

  if v_expected_count <> array_length(p_order_ids, 1) then
    raise exception 'Lista livrărilor nu mai este actuală. Reîncarcă pagina.';
  end if;

  if exists (
    select 1
    from unnest(p_order_ids) as requested(order_id)
    left join public.shop_orders shop_order
      on shop_order.id = requested.order_id
      and shop_order.tenant_id = v_tenant_id
      and shop_order.status = 'in_livrare'
      and (
        shop_order.delivery_date = v_today
        or (
          shop_order.delivery_date is null
          and (shop_order.created_at at time zone 'Europe/Bucharest')::date = v_today
        )
      )
    where shop_order.id is null
  ) then
    raise exception 'Lista conține o livrare invalidă pentru tenantul curent.';
  end if;

  with ordered_orders as (
    select order_id, position
    from unnest(p_order_ids) with ordinality as requested(order_id, position)
  ),
  updated_orders as (
    update public.shop_orders shop_order
    set
      delivery_position = ordered_orders.position::integer,
      delivery_date = coalesce(shop_order.delivery_date, v_today)
    from ordered_orders
    where shop_order.id = ordered_orders.order_id
      and shop_order.tenant_id = v_tenant_id
      and shop_order.status = 'in_livrare'
    returning shop_order.id
  )
  select count(*)
  into v_updated_count
  from updated_orders;

  if v_updated_count <> v_expected_count then
    raise exception 'Nu am putut salva întreaga ordine a livrărilor.';
  end if;

  return v_updated_count;
end;
$$;

revoke all on function public.list_shop_orders_in_delivery_today() from public;
grant execute on function public.list_shop_orders_in_delivery_today() to authenticated;

revoke all on function public.reorder_shop_deliveries_today(uuid[]) from public;
grant execute on function public.reorder_shop_deliveries_today(uuid[]) to authenticated;

notify pgrst, 'reload schema';
