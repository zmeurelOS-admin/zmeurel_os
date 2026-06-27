
create or replace function public.set_shop_order_in_delivery_with_reservation(p_shop_order_id uuid, p_delivery_date date default null)
returns public.shop_orders language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid(); v_tenant_id uuid; v_shop_order public.shop_orders%rowtype;
  v_reserved_count integer := 0; v_reserved_kg numeric := 0;
  v_item jsonb; v_product_id text; v_product_name text; v_item_label text;
  v_qty_numeric numeric; v_qty integer; v_unit_weight_kg numeric; v_line_weight_kg numeric; v_total_kg numeric := 0;
begin
  if v_user_id is null then raise exception 'Neautorizat'; end if;
  select public.current_tenant_id() into v_tenant_id;
  if v_tenant_id is null then raise exception 'Tenant invalid pentru utilizatorul curent.'; end if;
  if not (public.is_tenant_owner(v_tenant_id) or public.operator_can_write('comenzi') or public.operator_can_write('livrari')) then raise exception 'forbidden_read_only'; end if;
  perform pg_advisory_xact_lock(hashtext('stock-mutation'), hashtext(v_tenant_id::text));
  select shop_order.* into v_shop_order from public.shop_orders shop_order where shop_order.id = p_shop_order_id and shop_order.tenant_id = v_tenant_id for update;
  if not found then raise exception 'Comanda shop este invalidă pentru tenantul curent.'; end if;
  if v_shop_order.status = 'anulata' then raise exception 'Comanda anulată nu poate fi trimisă în livrare.'; end if;
  if v_shop_order.status = 'livrata' then raise exception 'Comanda shop este deja livrată.'; end if;

  select count(*), round(coalesce(sum(sr.cantitate_kg), 0)::numeric, 2) into v_reserved_count, v_reserved_kg
  from public.stock_reservations sr where sr.tenant_id = v_tenant_id and sr.shop_order_id = v_shop_order.id and sr.status = 'active';

  if v_reserved_count > 0 then
    update public.stock_reservations set status = 'released', released_at = now()
    where tenant_id = v_tenant_id and shop_order_id = v_shop_order.id and status = 'active';
  end if;

  if jsonb_typeof(v_shop_order.items) <> 'array' or jsonb_array_length(v_shop_order.items) = 0 then raise exception 'Comanda shop nu conține produse valide.'; end if;

  for v_item in select item.value from jsonb_array_elements(v_shop_order.items) as item(value) loop
    v_product_id := nullif(btrim(coalesce(v_item->>'vid', '')), '');
    v_item_label := nullif(btrim(coalesce(v_item->>'label', '')), '');
    if v_product_id is null then raise exception 'Un produs din comandă nu are identificator valid.'; end if;
    if jsonb_typeof(v_item->'qty') <> 'number' then raise exception 'Cantitatea pentru produsul % este invalidă.', coalesce(v_item_label, v_product_id); end if;
    v_qty_numeric := (v_item->>'qty')::numeric;
    if v_qty_numeric <= 0 or trunc(v_qty_numeric) <> v_qty_numeric then raise exception 'Cantitatea pentru produsul % trebuie să fie un număr întreg pozitiv.', coalesce(v_item_label, v_product_id); end if;
    v_qty := v_qty_numeric::integer;
    select product.name, product.unit_weight_kg into v_product_name, v_unit_weight_kg from public.shop_products product where product.id = v_product_id;
    if not found or v_unit_weight_kg is null or v_unit_weight_kg <= 0 then raise exception 'Produsul % nu are greutate configurată.', coalesce(v_item_label, v_product_name, v_product_id); end if;
    v_line_weight_kg := round((v_qty * v_unit_weight_kg)::numeric, 2);
    if v_line_weight_kg <= 0 then raise exception 'Greutatea calculată pentru produsul % este invalidă.', coalesce(v_item_label, v_product_name, v_product_id); end if;
    v_total_kg := round((v_total_kg + v_line_weight_kg)::numeric, 2);
  end loop;

  if v_total_kg <= 0 then raise exception 'Greutatea totală a comenzii trebuie să fie mai mare decât 0.'; end if;

  if v_shop_order.status = 'in_livrare' and v_reserved_count > 0 and v_reserved_kg = v_total_kg then return v_shop_order; end if;

  perform public.reserve_sellable_cal1_stock(v_tenant_id, 'shop_order', null, v_shop_order.id, v_total_kg,
    jsonb_build_object('reserved_via', 'set_shop_order_in_delivery_with_reservation', 'customer_name', v_shop_order.customer_name));

  update public.shop_orders set status = 'in_livrare', delivery_date = coalesce(p_delivery_date, delivery_date, public.bucharest_today())
  where id = v_shop_order.id and tenant_id = v_tenant_id returning * into v_shop_order;
  return v_shop_order;
end;
$$;

create or replace function public.release_shop_order_delivery_reservation(p_shop_order_id uuid, p_next_status text)
returns public.shop_orders language plpgsql security definer set search_path = public as $$
declare v_user_id uuid := auth.uid(); v_tenant_id uuid; v_shop_order public.shop_orders%rowtype;
begin
  if v_user_id is null then raise exception 'Neautorizat'; end if;
  select public.current_tenant_id() into v_tenant_id;
  if v_tenant_id is null then raise exception 'Tenant invalid pentru utilizatorul curent.'; end if;
  if not (public.is_tenant_owner(v_tenant_id) or public.operator_can_write('comenzi') or public.operator_can_write('livrari')) then raise exception 'forbidden_read_only'; end if;
  if p_next_status not in ('confirmata', 'anulata') then raise exception 'Statusul țintă este invalid pentru ieșirea din livrare.'; end if;
  perform pg_advisory_xact_lock(hashtext('stock-mutation'), hashtext(v_tenant_id::text));
  select shop_order.* into v_shop_order from public.shop_orders shop_order where shop_order.id = p_shop_order_id and shop_order.tenant_id = v_tenant_id for update;
  if not found then raise exception 'Comanda shop este invalidă pentru tenantul curent.'; end if;
  update public.stock_reservations set status = 'released', released_at = now()
  where tenant_id = v_tenant_id and shop_order_id = v_shop_order.id and status = 'active';
  update public.shop_orders set status = p_next_status where id = v_shop_order.id and tenant_id = v_tenant_id returning * into v_shop_order;
  return v_shop_order;
end;
$$;
;
