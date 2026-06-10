create or replace function public.deliver_shop_order_atomic(
  p_shop_order_id uuid,
  p_payment_status text default 'platit'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_today date := public.bucharest_today();
  v_shop_order public.shop_orders%rowtype;
  v_existing_link public.shop_order_erp_links%rowtype;
  v_comanda public.comenzi%rowtype;
  v_delivery_result jsonb;
  v_item jsonb;
  v_product_id text;
  v_product_name text;
  v_item_label text;
  v_qty_numeric numeric;
  v_qty integer;
  v_unit_weight_kg numeric;
  v_line_weight_kg numeric;
  v_total_kg numeric := 0;
  v_price_per_kg numeric;
  v_weight_snapshot jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'Neautorizat';
  end if;

  select public.current_tenant_id()
  into v_tenant_id;

  if v_tenant_id is null then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  select shop_order.*
  into v_shop_order
  from public.shop_orders shop_order
  where shop_order.id = p_shop_order_id
    and shop_order.tenant_id = v_tenant_id
  for update;

  if not found then
    raise exception 'Comanda shop este invalidă pentru tenantul curent.';
  end if;

  select link.*
  into v_existing_link
  from public.shop_order_erp_links link
  where link.shop_order_id = v_shop_order.id
    and link.tenant_id = v_tenant_id;

  if found then
    select erp_order.*
    into v_comanda
    from public.comenzi erp_order
    where erp_order.id = v_existing_link.comanda_id
      and erp_order.tenant_id = v_tenant_id;

    update public.shop_campaign_milestone_rewards
    set status = 'validated'
    where order_id = v_shop_order.id
      and status = 'pending';

    return jsonb_build_object(
      'already_delivered', true,
      'shop_order_id', v_existing_link.shop_order_id,
      'comanda_id', v_existing_link.comanda_id,
      'vanzare_id', v_comanda.linked_vanzare_id,
      'total_kg', v_comanda.cantitate_kg,
      'total_lei', v_comanda.total,
      'weight_snapshot', v_existing_link.weight_snapshot
    );
  end if;

  if v_shop_order.status <> 'in_livrare' then
    raise exception 'Doar comenzile aflate în livrare pot fi marcate ca livrate.';
  end if;

  if jsonb_typeof(v_shop_order.items) <> 'array'
    or jsonb_array_length(v_shop_order.items) = 0 then
    raise exception 'Comanda shop nu conține produse valide.';
  end if;

  for v_item in
    select item.value
    from jsonb_array_elements(v_shop_order.items) as item(value)
  loop
    v_product_id := nullif(btrim(coalesce(v_item->>'vid', '')), '');
    v_item_label := nullif(btrim(coalesce(v_item->>'label', '')), '');

    if v_product_id is null then
      raise exception 'Un produs din comandă nu are identificator valid.';
    end if;

    if jsonb_typeof(v_item->'qty') <> 'number' then
      raise exception 'Cantitatea pentru produsul % este invalidă.',
        coalesce(v_item_label, v_product_id);
    end if;

    v_qty_numeric := (v_item->>'qty')::numeric;
    if v_qty_numeric <= 0 or trunc(v_qty_numeric) <> v_qty_numeric then
      raise exception 'Cantitatea pentru produsul % trebuie să fie un număr întreg pozitiv.',
        coalesce(v_item_label, v_product_id);
    end if;
    v_qty := v_qty_numeric::integer;

    select product.name, product.unit_weight_kg
    into v_product_name, v_unit_weight_kg
    from public.shop_products product
    where product.id = v_product_id;

    if not found or v_unit_weight_kg is null or v_unit_weight_kg <= 0 then
      raise exception 'Produsul % nu are greutate configurată.',
        coalesce(v_item_label, v_product_name, v_product_id);
    end if;

    v_line_weight_kg := round((v_qty * v_unit_weight_kg)::numeric, 2);
    if v_line_weight_kg <= 0 then
      raise exception 'Greutatea calculată pentru produsul % este invalidă.',
        coalesce(v_item_label, v_product_name, v_product_id);
    end if;

    v_total_kg := round((v_total_kg + v_line_weight_kg)::numeric, 2);
    v_weight_snapshot := v_weight_snapshot || jsonb_build_array(
      jsonb_build_object(
        'vid', v_product_id,
        'label', coalesce(v_item_label, v_product_name, v_product_id),
        'qty', v_qty,
        'unit_weight_kg', v_unit_weight_kg,
        'line_weight_kg', v_line_weight_kg
      )
    );
  end loop;

  if v_total_kg <= 0 then
    raise exception 'Greutatea totală a comenzii trebuie să fie mai mare decât 0.';
  end if;

  if coalesce(v_shop_order.total_lei, 0) <= 0 then
    raise exception 'Valoarea comenzii trebuie să fie mai mare decât 0.';
  end if;

  v_price_per_kg := round((v_shop_order.total_lei::numeric / v_total_kg)::numeric, 2);

  insert into public.comenzi (
    tenant_id,
    client_id,
    client_nume_manual,
    telefon,
    locatie_livrare,
    data_comanda,
    data_livrare,
    cantitate_kg,
    pret_per_kg,
    total,
    status,
    observatii,
    data_origin
  )
  values (
    v_tenant_id,
    null,
    v_shop_order.customer_name,
    v_shop_order.customer_phone,
    concat_ws(', ', nullif(btrim(coalesce(v_shop_order.delivery_address, '')), ''), nullif(btrim(coalesce(v_shop_order.delivery_city, '')), '')),
    v_today,
    v_today,
    v_total_kg,
    v_price_per_kg,
    v_shop_order.total_lei,
    'in_livrare',
    concat_ws(
      ' | ',
      format('Comandă shop %s', v_shop_order.id),
      nullif(btrim(coalesce(v_shop_order.notes, '')), '')
    ),
    'shop_order_bridge'
  )
  returning *
  into v_comanda;

  v_delivery_result := public.deliver_order_atomic(
    v_comanda.id,
    v_total_kg,
    coalesce(nullif(btrim(coalesce(p_payment_status, '')), ''), 'platit'),
    null
  );

  insert into public.shop_order_erp_links (
    shop_order_id,
    comanda_id,
    tenant_id,
    weight_snapshot
  )
  values (
    v_shop_order.id,
    v_comanda.id,
    v_tenant_id,
    v_weight_snapshot
  );

  update public.shop_orders
  set status = 'livrata'
  where id = v_shop_order.id
    and tenant_id = v_tenant_id;

  update public.shop_campaign_milestone_rewards
  set status = 'validated'
  where order_id = v_shop_order.id
    and status = 'pending';

  return jsonb_build_object(
    'already_delivered', false,
    'shop_order_id', v_shop_order.id,
    'comanda_id', v_comanda.id,
    'vanzare_id', v_delivery_result->'vanzare'->>'id',
    'total_kg', v_total_kg,
    'total_lei', v_shop_order.total_lei,
    'weight_snapshot', v_weight_snapshot,
    'delivery', v_delivery_result
  );
end;
$$;

revoke all on function public.deliver_shop_order_atomic(uuid, text) from public;
grant execute on function public.deliver_shop_order_atomic(uuid, text) to authenticated;

notify pgrst, 'reload schema';
