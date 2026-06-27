
create or replace function public.resolve_shop_order_total_kg_loose(p_items jsonb)
returns numeric language sql security definer set search_path = public as $$
  with items as (
    select
      nullif(btrim(coalesce(item.value->>'vid', '')), '') as product_id,
      case when jsonb_typeof(item.value->'qty') = 'number' then greatest((item.value->>'qty')::numeric, 0) else 0 end as qty
    from jsonb_array_elements(
      case when jsonb_typeof(coalesce(p_items, '[]'::jsonb)) = 'array' then coalesce(p_items, '[]'::jsonb) else '[]'::jsonb end
    ) as item(value)
  )
  select round(coalesce(sum(items.qty * coalesce(nullif(product.unit_weight_kg, 0), 0.5)), 0)::numeric, 2)
  from items
  left join public.shop_products product on product.id = items.product_id;
$$;

create or replace function public.list_sellable_cal1_buckets_for_reservation(p_tenant_id uuid default null)
returns table (locatie_id uuid, produs text, depozit text, calitate text, available_kg numeric)
language sql security definer set search_path = public as $$
  with resolved_tenant as (
    select coalesce(p_tenant_id, public.current_tenant_id()) as tenant_id
  ),
  ledger as (
    select ms.locatie_id,
      coalesce(nullif(btrim(ms.produs), ''), 'zmeura') as produs,
      coalesce(nullif(btrim(ms.depozit), ''), 'fresh') as depozit,
      round(sum(case when ms.tip_miscare in ('vanzare', 'consum', 'oferit_gratuit', 'pierdere') then -coalesce(ms.cantitate_kg, 0) else coalesce(ms.cantitate_kg, 0) end)::numeric, 2) as ledger_kg
    from public.miscari_stoc ms
    join resolved_tenant tenant on tenant.tenant_id = ms.tenant_id
    where ms.locatie_id is not null and ms.calitate = 'cal1' and coalesce(ms.depozit, 'fresh') = 'fresh'
      and ms.tip_miscare is not null and ms.cantitate_kg is not null
    group by ms.locatie_id, coalesce(nullif(btrim(ms.produs), ''), 'zmeura'), coalesce(nullif(btrim(ms.depozit), ''), 'fresh')
  ),
  reserved as (
    select sr.locatie_id,
      coalesce(nullif(btrim(sr.produs), ''), 'zmeura') as produs,
      coalesce(nullif(btrim(sr.depozit), ''), 'fresh') as depozit,
      round(sum(sr.cantitate_kg)::numeric, 2) as reserved_kg
    from public.stock_reservations sr
    join resolved_tenant tenant on tenant.tenant_id = sr.tenant_id
    where sr.status = 'active' and sr.calitate = 'cal1' and sr.locatie_id is not null
    group by sr.locatie_id, coalesce(nullif(btrim(sr.produs), ''), 'zmeura'), coalesce(nullif(btrim(sr.depozit), ''), 'fresh')
  )
  select ledger.locatie_id, ledger.produs, ledger.depozit, 'cal1'::text as calitate,
    round(greatest(ledger.ledger_kg - coalesce(reserved.reserved_kg, 0), 0)::numeric, 2) as available_kg
  from ledger
  left join reserved on reserved.locatie_id = ledger.locatie_id and reserved.produs = ledger.produs and reserved.depozit = ledger.depozit
  where round(greatest(ledger.ledger_kg - coalesce(reserved.reserved_kg, 0), 0)::numeric, 2) > 0
  order by available_kg desc, ledger.locatie_id nulls last, ledger.produs asc;
$$;

create or replace function public.get_sellable_cal1_stock_summary(p_tenant_id uuid default null)
returns table (recoltat_cal1_kg numeric, consumat_definitiv_cal1_kg numeric, rezervat_activ_cal1_kg numeric, legacy_in_livrare_fara_rezervare_kg numeric, stoc_cal1_ledger_kg numeric, disponibil_cal1_kg numeric)
language plpgsql security definer set search_path = public as $$
declare
  v_tenant_id uuid;
  v_recoltat numeric := 0; v_consumat numeric := 0; v_rezervat numeric := 0;
  v_legacy_manual numeric := 0; v_legacy_shop numeric := 0; v_legacy_total numeric := 0;
  v_disponibil numeric := 0; v_ledger numeric := 0;
begin
  select coalesce(p_tenant_id, public.current_tenant_id()) into v_tenant_id;
  if v_tenant_id is null then raise exception 'Tenant invalid pentru utilizatorul curent.'; end if;

  select round(coalesce(sum(ms.cantitate_kg), 0)::numeric, 2) into v_recoltat
  from public.miscari_stoc ms where ms.tenant_id = v_tenant_id and ms.calitate = 'cal1'
    and coalesce(ms.depozit, 'fresh') = 'fresh' and ms.tip_miscare = 'recoltare';

  select round(coalesce(sum(ms.cantitate_kg), 0)::numeric, 2) into v_consumat
  from public.miscari_stoc ms where ms.tenant_id = v_tenant_id and ms.calitate = 'cal1'
    and coalesce(ms.depozit, 'fresh') = 'fresh' and ms.tip_miscare in ('vanzare', 'consum', 'oferit_gratuit', 'pierdere');

  select round(coalesce(sum(sr.cantitate_kg), 0)::numeric, 2) into v_rezervat
  from public.stock_reservations sr where sr.tenant_id = v_tenant_id and sr.status = 'active' and sr.calitate = 'cal1';

  select round(coalesce(sum(bucket.available_kg), 0)::numeric, 2) into v_disponibil
  from public.list_sellable_cal1_buckets_for_reservation(v_tenant_id) as bucket;

  v_ledger := round((v_disponibil + v_rezervat)::numeric, 2);

  select round(coalesce(sum(c.cantitate_kg), 0)::numeric, 2) into v_legacy_manual
  from public.comenzi c where c.tenant_id = v_tenant_id and c.status = 'in_livrare'
    and not exists (select 1 from public.stock_reservations sr where sr.tenant_id = v_tenant_id and sr.comanda_id = c.id and sr.status = 'active');

  select round(coalesce(sum(public.resolve_shop_order_total_kg_loose(shop_order.items)), 0)::numeric, 2) into v_legacy_shop
  from public.shop_orders shop_order where shop_order.tenant_id = v_tenant_id and shop_order.status = 'in_livrare'
    and not exists (select 1 from public.stock_reservations sr where sr.tenant_id = v_tenant_id and sr.shop_order_id = shop_order.id and sr.status = 'active');

  v_legacy_total := round((v_legacy_manual + v_legacy_shop)::numeric, 2);
  v_disponibil := round((v_disponibil - v_legacy_total)::numeric, 2);

  return query select v_recoltat, v_consumat, v_rezervat, v_legacy_total, v_ledger, v_disponibil;
end;
$$;
;
