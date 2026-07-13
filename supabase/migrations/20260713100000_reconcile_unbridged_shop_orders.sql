-- Safety net pentru comenzile shop create fără bridge ERP.
-- Promovarea este idempotentă: shop_order_erp_links.shop_order_id este PK, iar
-- promote_shop_order_to_comanda returnează bridge-ul existent la retry.

-- Păstrează statusul terminal la promovarea retroactivă. Pentru `livrata`,
-- disponibilul derivat rămâne neutru: comanda iese din termenul shop nepromovat
-- și intră cu aceeași cantitate în termenul comenzi livrate. Nu se creează vânzare.
create or replace function public.promote_shop_order_to_comanda(
  p_shop_order_id uuid
)
returns public.comenzi
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
  v_is_service boolean := (v_role = 'service_role');
  v_tenant_id uuid;
  v_today date := public.bucharest_today();
  v_shop_order public.shop_orders%rowtype;
  v_existing_link public.shop_order_erp_links%rowtype;
  v_comanda public.comenzi%rowtype;
  v_item jsonb;
  v_product_id text;
  v_product_name text;
  v_item_label text;
  v_qty_numeric numeric;
  v_qty numeric;
  v_unit_weight_kg numeric;
  v_line_weight_kg numeric;
  v_total_kg numeric := 0;
  v_price_per_kg numeric;
  v_weight_snapshot jsonb := '[]'::jsonb;
  v_initial_status text;
  v_order_kind text;
  v_produs_id uuid;
begin
  if v_user_id is null and not v_is_service then
    raise exception 'Neautorizat';
  end if;

  if v_is_service then
    select shop_order.tenant_id
    into v_tenant_id
    from public.shop_orders shop_order
    where shop_order.id = p_shop_order_id;

    if not found or v_tenant_id is null then
      raise exception 'Comanda shop este invalidă.';
    end if;
  else
    select public.current_tenant_id()
    into v_tenant_id;

    if v_tenant_id is null then
      raise exception 'Tenant invalid pentru utilizatorul curent.';
    end if;

    if not (
      public.is_tenant_owner(v_tenant_id)
      or public.operator_can_write('comenzi')
      or public.operator_can_write('livrari')
    ) then
      raise exception 'forbidden_read_only';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtext('stock-mutation'), hashtext(v_tenant_id::text));

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

    return v_comanda;
  end if;

  v_total_kg := public.resolve_shop_order_total_kg_loose(v_shop_order.items);

  for v_item in
    select item.value
    from jsonb_array_elements(
      case
        when jsonb_typeof(coalesce(v_shop_order.items, '[]'::jsonb)) = 'array'
          then coalesce(v_shop_order.items, '[]'::jsonb)
        else '[]'::jsonb
      end
    ) as item(value)
  loop
    v_product_id := nullif(btrim(coalesce(v_item->>'vid', '')), '');
    v_item_label := nullif(btrim(coalesce(v_item->>'label', '')), '');
    v_qty_numeric := case
      when jsonb_typeof(v_item->'qty') = 'number'
        then greatest((v_item->>'qty')::numeric, 0)
      else 0
    end;
    v_qty := v_qty_numeric;

    select product.name, product.unit_weight_kg
    into v_product_name, v_unit_weight_kg
    from public.shop_products product
    where product.id = v_product_id;

    if not found then
      v_product_name := null;
      v_unit_weight_kg := 0.5;
    else
      v_unit_weight_kg := coalesce(nullif(v_unit_weight_kg, 0), 0.5);
    end if;

    v_line_weight_kg := round((v_qty * v_unit_weight_kg)::numeric, 2);
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

  if coalesce(v_shop_order.total_lei, 0) < 0 then
    raise exception 'Valoarea comenzii nu poate fi negativă.';
  end if;

  v_price_per_kg := round((coalesce(v_shop_order.total_lei, 0)::numeric / v_total_kg)::numeric, 2);

  v_initial_status := case v_shop_order.status
    when 'noua' then 'noua'
    when 'confirmata' then 'confirmata'
    when 'livrata' then 'livrata'
    when 'anulata' then 'anulata'
    else 'confirmata'
  end;

  v_order_kind := case
    when v_shop_order.order_kind in ('cadou', 'consum_propriu') then v_shop_order.order_kind
    else 'manual'
  end;

  v_produs_id := public.resolve_zmeura_produs_id(v_tenant_id);

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
    order_kind,
    status,
    observatii,
    data_origin,
    produs_id
  )
  values (
    v_tenant_id,
    null,
    v_shop_order.customer_name,
    v_shop_order.customer_phone,
    concat_ws(', ', nullif(btrim(coalesce(v_shop_order.delivery_address, '')), ''), nullif(btrim(coalesce(v_shop_order.delivery_city, '')), '')),
    coalesce(v_shop_order.created_at::date, v_today),
    coalesce(v_shop_order.delivery_date, v_today),
    v_total_kg,
    v_price_per_kg,
    coalesce(v_shop_order.total_lei, 0),
    v_order_kind,
    v_initial_status,
    concat_ws(
      ' | ',
      format('Comandă shop %s', v_shop_order.id),
      nullif(btrim(coalesce(v_shop_order.notes, '')), '')
    ),
    'shop_order_bridge',
    v_produs_id
  )
  returning *
  into v_comanda;

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

  return v_comanda;
end;
$$;

create or replace function public.reconcile_unbridged_shop_orders(
  p_tenant_id uuid default null,
  p_limit integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
  v_is_service boolean := (v_role = 'service_role');
  v_current_tenant_id uuid;
  v_scope_tenant_id uuid;
  v_limit integer := greatest(coalesce(p_limit, 10000), 1);
  v_scanned integer := 0;
  v_promoted integer := 0;
  v_skipped_in_delivery integer := 0;
  v_failed integer := 0;
  v_failures jsonb := '[]'::jsonb;
  r record;
begin
  if v_user_id is null and not v_is_service then
    raise exception 'Neautorizat';
  end if;

  if v_is_service then
    v_scope_tenant_id := p_tenant_id;
  else
    select public.current_tenant_id() into v_current_tenant_id;
    if v_current_tenant_id is null or (p_tenant_id is not null and p_tenant_id <> v_current_tenant_id) then
      raise exception 'Tenant invalid pentru utilizatorul curent.';
    end if;
    if not (
      public.is_tenant_owner(v_current_tenant_id)
      or public.operator_can_write('comenzi')
      or public.operator_can_write('livrari')
    ) then
      raise exception 'forbidden_read_only';
    end if;
    v_scope_tenant_id := v_current_tenant_id;
  end if;

  for r in
    select shop_order.id, shop_order.status
    from public.shop_orders shop_order
    left join public.shop_order_erp_links link
      on link.shop_order_id = shop_order.id
    where link.comanda_id is null
      and (v_scope_tenant_id is null or shop_order.tenant_id = v_scope_tenant_id)
    order by shop_order.created_at asc, shop_order.id asc
    limit v_limit
  loop
    v_scanned := v_scanned + 1;

    if r.status = 'in_livrare' then
      v_skipped_in_delivery := v_skipped_in_delivery + 1;
      continue;
    end if;

    begin
      perform public.promote_shop_order_to_comanda(r.id);
      v_promoted := v_promoted + 1;
    exception when others then
      v_failed := v_failed + 1;
      if jsonb_array_length(v_failures) < 100 then
        v_failures := v_failures || jsonb_build_array(
          jsonb_build_object('shop_order_id', r.id, 'status', r.status, 'error', sqlerrm)
        );
      end if;
    end;
  end loop;

  return jsonb_build_object(
    'scanned', v_scanned,
    'promoted', v_promoted,
    'skipped_in_delivery', v_skipped_in_delivery,
    'failed', v_failed,
    'failures', v_failures
  );
end;
$$;

comment on function public.reconcile_unbridged_shop_orders(uuid, integer) is
  'Reconciliere idempotentă a shop_orders fără bridge ERP. Reutilizează promote_shop_order_to_comanda; comenzile in_livrare sunt lăsate pentru fluxul atomic set_shop_order_in_delivery.';
