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

create index if not exists stock_reservations_tenant_status_idx
  on public.stock_reservations (tenant_id, status);

create index if not exists stock_reservations_comanda_id_idx
  on public.stock_reservations (comanda_id);

create index if not exists stock_reservations_shop_order_id_idx
  on public.stock_reservations (shop_order_id);

alter table public.stock_reservations enable row level security;

drop policy if exists stock_reservations_select on public.stock_reservations;
create policy stock_reservations_select
  on public.stock_reservations
  for select
  to authenticated
  using (tenant_id = public.current_tenant_id());

drop policy if exists stock_reservations_insert on public.stock_reservations;
create policy stock_reservations_insert
  on public.stock_reservations
  for insert
  to authenticated
  with check (
    tenant_id = public.current_tenant_id()
    and (public.is_tenant_owner(tenant_id) or public.operator_can_write('comenzi'))
  );

drop policy if exists stock_reservations_update on public.stock_reservations;
create policy stock_reservations_update
  on public.stock_reservations
  for update
  to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and (public.is_tenant_owner(tenant_id) or public.operator_can_write('comenzi'))
  )
  with check (
    tenant_id = public.current_tenant_id()
    and (public.is_tenant_owner(tenant_id) or public.operator_can_write('comenzi'))
  );

drop policy if exists stock_reservations_delete on public.stock_reservations;
create policy stock_reservations_delete
  on public.stock_reservations
  for delete
  to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and public.is_tenant_owner(tenant_id)
  );

create or replace function public.resolve_shop_order_total_kg_loose(
  p_items jsonb
)
returns numeric
language sql
security definer
set search_path = public
as $$
  with items as (
    select
      nullif(btrim(coalesce(item.value->>'vid', '')), '') as product_id,
      case
        when jsonb_typeof(item.value->'qty') = 'number' then greatest((item.value->>'qty')::numeric, 0)
        else 0
      end as qty
    from jsonb_array_elements(
      case
        when jsonb_typeof(coalesce(p_items, '[]'::jsonb)) = 'array' then coalesce(p_items, '[]'::jsonb)
        else '[]'::jsonb
      end
    ) as item(value)
  )
  select round(
    coalesce(
      sum(
        items.qty * coalesce(nullif(product.unit_weight_kg, 0), 0.5)
      ),
      0
    )::numeric,
    2
  )
  from items
  left join public.shop_products product
    on product.id = items.product_id;
$$;

create or replace function public.list_sellable_cal1_buckets_for_reservation(
  p_tenant_id uuid default null
)
returns table (
  locatie_id uuid,
  produs text,
  depozit text,
  calitate text,
  available_kg numeric
)
language sql
security definer
set search_path = public
as $$
  with resolved_tenant as (
    select coalesce(p_tenant_id, public.current_tenant_id()) as tenant_id
  ),
  ledger as (
    select
      ms.locatie_id,
      coalesce(nullif(btrim(ms.produs), ''), 'zmeura') as produs,
      coalesce(nullif(btrim(ms.depozit), ''), 'fresh') as depozit,
      round(
        sum(
          case
            when ms.tip_miscare in ('vanzare', 'consum', 'oferit_gratuit', 'pierdere') then -coalesce(ms.cantitate_kg, 0)
            else coalesce(ms.cantitate_kg, 0)
          end
        )::numeric,
        2
      ) as ledger_kg
    from public.miscari_stoc ms
    join resolved_tenant tenant
      on tenant.tenant_id = ms.tenant_id
    where ms.locatie_id is not null
      and ms.calitate = 'cal1'
      and coalesce(ms.depozit, 'fresh') = 'fresh'
      and ms.tip_miscare is not null
      and ms.cantitate_kg is not null
    group by ms.locatie_id, coalesce(nullif(btrim(ms.produs), ''), 'zmeura'), coalesce(nullif(btrim(ms.depozit), ''), 'fresh')
  ),
  reserved as (
    select
      sr.locatie_id,
      coalesce(nullif(btrim(sr.produs), ''), 'zmeura') as produs,
      coalesce(nullif(btrim(sr.depozit), ''), 'fresh') as depozit,
      round(sum(sr.cantitate_kg)::numeric, 2) as reserved_kg
    from public.stock_reservations sr
    join resolved_tenant tenant
      on tenant.tenant_id = sr.tenant_id
    where sr.status = 'active'
      and sr.calitate = 'cal1'
      and sr.locatie_id is not null
    group by sr.locatie_id, coalesce(nullif(btrim(sr.produs), ''), 'zmeura'), coalesce(nullif(btrim(sr.depozit), ''), 'fresh')
  )
  select
    ledger.locatie_id,
    ledger.produs,
    ledger.depozit,
    'cal1'::text as calitate,
    round(greatest(ledger.ledger_kg - coalesce(reserved.reserved_kg, 0), 0)::numeric, 2) as available_kg
  from ledger
  left join reserved
    on reserved.locatie_id = ledger.locatie_id
   and reserved.produs = ledger.produs
   and reserved.depozit = ledger.depozit
  where round(greatest(ledger.ledger_kg - coalesce(reserved.reserved_kg, 0), 0)::numeric, 2) > 0
  order by available_kg desc, ledger.locatie_id nulls last, ledger.produs asc;
$$;

create or replace function public.get_sellable_cal1_stock_summary(
  p_tenant_id uuid default null
)
returns table (
  recoltat_cal1_kg numeric,
  consumat_definitiv_cal1_kg numeric,
  rezervat_activ_cal1_kg numeric,
  legacy_in_livrare_fara_rezervare_kg numeric,
  stoc_cal1_ledger_kg numeric,
  disponibil_cal1_kg numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_recoltat numeric := 0;
  v_consumat numeric := 0;
  v_rezervat numeric := 0;
  v_legacy_manual numeric := 0;
  v_legacy_shop numeric := 0;
  v_legacy_total numeric := 0;
  v_disponibil numeric := 0;
  v_ledger numeric := 0;
begin
  select coalesce(p_tenant_id, public.current_tenant_id())
  into v_tenant_id;

  if v_tenant_id is null then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  select round(coalesce(sum(ms.cantitate_kg), 0)::numeric, 2)
  into v_recoltat
  from public.miscari_stoc ms
  where ms.tenant_id = v_tenant_id
    and ms.calitate = 'cal1'
    and coalesce(ms.depozit, 'fresh') = 'fresh'
    and ms.tip_miscare = 'recoltare';

  select round(coalesce(sum(ms.cantitate_kg), 0)::numeric, 2)
  into v_consumat
  from public.miscari_stoc ms
  where ms.tenant_id = v_tenant_id
    and ms.calitate = 'cal1'
    and coalesce(ms.depozit, 'fresh') = 'fresh'
    and ms.tip_miscare in ('vanzare', 'consum', 'oferit_gratuit', 'pierdere');

  select round(coalesce(sum(sr.cantitate_kg), 0)::numeric, 2)
  into v_rezervat
  from public.stock_reservations sr
  where sr.tenant_id = v_tenant_id
    and sr.status = 'active'
    and sr.calitate = 'cal1';

  select round(coalesce(sum(bucket.available_kg), 0)::numeric, 2)
  into v_disponibil
  from public.list_sellable_cal1_buckets_for_reservation(v_tenant_id) as bucket;

  v_ledger := round((v_disponibil + v_rezervat)::numeric, 2);

  select round(coalesce(sum(c.cantitate_kg), 0)::numeric, 2)
  into v_legacy_manual
  from public.comenzi c
  where c.tenant_id = v_tenant_id
    and c.status = 'in_livrare'
    and not exists (
      select 1
      from public.stock_reservations sr
      where sr.tenant_id = v_tenant_id
        and sr.comanda_id = c.id
        and sr.status = 'active'
    );

  select round(coalesce(sum(public.resolve_shop_order_total_kg_loose(shop_order.items)), 0)::numeric, 2)
  into v_legacy_shop
  from public.shop_orders shop_order
  where shop_order.tenant_id = v_tenant_id
    and shop_order.status = 'in_livrare'
    and not exists (
      select 1
      from public.stock_reservations sr
      where sr.tenant_id = v_tenant_id
        and sr.shop_order_id = shop_order.id
        and sr.status = 'active'
    );

  v_legacy_total := round((v_legacy_manual + v_legacy_shop)::numeric, 2);
  v_disponibil := round((v_disponibil - v_legacy_total)::numeric, 2);

  return query
  select
    v_recoltat,
    v_consumat,
    v_rezervat,
    v_legacy_total,
    v_ledger,
    v_disponibil;
end;
$$;

create or replace function public.reserve_sellable_cal1_stock(
  p_tenant_id uuid,
  p_source_type text,
  p_comanda_id uuid default null,
  p_shop_order_id uuid default null,
  p_required_kg numeric default 0,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_required_kg numeric := round(greatest(coalesce(p_required_kg, 0), 0)::numeric, 2);
  v_remaining_kg numeric := v_required_kg;
  v_take numeric;
  v_summary record;
  v_bucket record;
begin
  if p_tenant_id is null then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  if p_source_type not in ('comanda', 'shop_order') then
    raise exception 'Tip rezervare invalid.';
  end if;

  if v_required_kg <= 0 then
    raise exception 'Cantitatea rezervată trebuie să fie mai mare decât 0.';
  end if;

  select *
  into v_summary
  from public.get_sellable_cal1_stock_summary(p_tenant_id);

  if coalesce(v_summary.disponibil_cal1_kg, 0) < v_required_kg then
    raise exception 'Stoc insuficient: ai doar % kg cal1 disponibili, comanda cere % kg',
      trim(to_char(coalesce(v_summary.disponibil_cal1_kg, 0), 'FM999999990.00')),
      trim(to_char(v_required_kg, 'FM999999990.00'));
  end if;

  for v_bucket in
    select *
    from public.list_sellable_cal1_buckets_for_reservation(p_tenant_id)
  loop
    exit when v_remaining_kg <= 0;

    v_take := round(least(coalesce(v_bucket.available_kg, 0), v_remaining_kg)::numeric, 2);
    if v_take <= 0 then
      continue;
    end if;

    insert into public.stock_reservations (
      tenant_id,
      source_type,
      comanda_id,
      shop_order_id,
      locatie_id,
      produs,
      depozit,
      calitate,
      cantitate_kg,
      status,
      metadata
    )
    values (
      p_tenant_id,
      p_source_type,
      p_comanda_id,
      p_shop_order_id,
      v_bucket.locatie_id,
      coalesce(nullif(btrim(v_bucket.produs), ''), 'zmeura'),
      coalesce(nullif(btrim(v_bucket.depozit), ''), 'fresh'),
      'cal1',
      v_take,
      'active',
      coalesce(p_metadata, '{}'::jsonb)
    );

    v_remaining_kg := round((v_remaining_kg - v_take)::numeric, 2);
  end loop;

  if v_remaining_kg > 0 then
    raise exception 'Stoc insuficient: ai doar % kg cal1 disponibili, comanda cere % kg',
      trim(to_char(coalesce(v_summary.disponibil_cal1_kg, 0), 'FM999999990.00')),
      trim(to_char(v_required_kg, 'FM999999990.00'));
  end if;
end;
$$;

create or replace function public.consume_active_stock_reservations_for_comanda(
  p_tenant_id uuid,
  p_comanda_id uuid,
  p_vanzare_id uuid,
  p_delivered_qty numeric,
  p_delivery_date date,
  p_delivery_note text default 'Consum stoc prin livrare comanda'
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation record;
  v_remaining numeric := round(greatest(coalesce(p_delivered_qty, 0), 0)::numeric, 2);
  v_take numeric := 0;
  v_consumed numeric := 0;
begin
  if v_remaining <= 0 then
    return 0;
  end if;

  for v_reservation in
    select *
    from public.stock_reservations sr
    where sr.tenant_id = p_tenant_id
      and sr.comanda_id = p_comanda_id
      and sr.status = 'active'
    order by sr.reserved_at asc, sr.id asc
    for update
  loop
    exit when v_remaining <= 0;

    v_take := round(least(coalesce(v_reservation.cantitate_kg, 0), v_remaining)::numeric, 2);
    if v_take <= 0 then
      continue;
    end if;

    insert into public.miscari_stoc (
      tenant_id,
      locatie_id,
      produs,
      calitate,
      depozit,
      tip_miscare,
      cantitate_kg,
      tip,
      cantitate_cal1,
      cantitate_cal2,
      referinta_id,
      data,
      observatii,
      descriere
    )
    values (
      p_tenant_id,
      v_reservation.locatie_id,
      v_reservation.produs,
      'cal1',
      v_reservation.depozit,
      'vanzare',
      v_take,
      'vanzare',
      -v_take,
      0,
      p_vanzare_id,
      p_delivery_date,
      p_delivery_note,
      p_delivery_note
    );

    if round(coalesce(v_reservation.cantitate_kg, 0)::numeric, 2) = v_take then
      update public.stock_reservations
      set status = 'consumed',
          consumed_at = now(),
          linked_vanzare_id = p_vanzare_id
      where id = v_reservation.id;
    else
      update public.stock_reservations
      set cantitate_kg = round((coalesce(v_reservation.cantitate_kg, 0) - v_take)::numeric, 2)
      where id = v_reservation.id;

      insert into public.stock_reservations (
        tenant_id,
        source_type,
        comanda_id,
        shop_order_id,
        locatie_id,
        produs,
        depozit,
        calitate,
        cantitate_kg,
        status,
        reserved_at,
        consumed_at,
        linked_vanzare_id,
        metadata
      )
      values (
        v_reservation.tenant_id,
        v_reservation.source_type,
        v_reservation.comanda_id,
        v_reservation.shop_order_id,
        v_reservation.locatie_id,
        v_reservation.produs,
        v_reservation.depozit,
        v_reservation.calitate,
        v_take,
        'consumed',
        v_reservation.reserved_at,
        now(),
        p_vanzare_id,
        coalesce(v_reservation.metadata, '{}'::jsonb)
      );
    end if;

    v_consumed := round((v_consumed + v_take)::numeric, 2);
    v_remaining := round((v_remaining - v_take)::numeric, 2);
  end loop;

  return v_consumed;
end;
$$;

create or replace function public.sync_recoltare_stock_movements(
  p_recoltare_id uuid,
  p_tenant_id uuid,
  p_parcela_id uuid,
  p_data date,
  p_kg_cal1 numeric default 0,
  p_kg_cal2 numeric default 0,
  p_observatii text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_identity jsonb;
  v_produs text;
  v_kg_cal1 numeric := round(greatest(coalesce(p_kg_cal1, 0), 0)::numeric, 2);
begin
  delete from public.miscari_stoc
  where tenant_id = p_tenant_id
    and referinta_id = p_recoltare_id
    and (
      tip = 'recoltare'
      or tip_miscare = 'recoltare'
    );

  if p_parcela_id is null then
    return;
  end if;

  v_identity := public.resolve_recoltare_stock_identity(p_parcela_id, p_observatii, p_tenant_id);
  v_produs := coalesce(nullif(btrim(v_identity ->> 'produs'), ''), 'produs-necunoscut');

  if v_kg_cal1 > 0 then
    insert into public.miscari_stoc (
      tenant_id,
      locatie_id,
      produs,
      calitate,
      depozit,
      tip_miscare,
      cantitate_kg,
      tip,
      cantitate_cal1,
      cantitate_cal2,
      referinta_id,
      data
    )
    values (
      p_tenant_id,
      p_parcela_id,
      v_produs,
      'cal1',
      'fresh',
      'recoltare',
      v_kg_cal1,
      'recoltare',
      v_kg_cal1,
      0,
      p_recoltare_id,
      p_data
    );
  end if;
end;
$$;

create or replace function public.set_comanda_in_delivery_with_reservation(
  p_comanda_id uuid
)
returns public.comenzi
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_order public.comenzi;
  v_reserved_count integer := 0;
  v_reserved_kg numeric := 0;
begin
  if v_user_id is null then
    raise exception 'Neautorizat';
  end if;

  select public.current_tenant_id()
  into v_tenant_id;

  if v_tenant_id is null then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  if not (public.is_tenant_owner(v_tenant_id) or public.operator_can_write('comenzi')) then
    raise exception 'forbidden_read_only';
  end if;

  perform pg_advisory_xact_lock(hashtext('stock-mutation'), hashtext(v_tenant_id::text));

  select *
  into v_order
  from public.comenzi
  where id = p_comanda_id
    and tenant_id = v_tenant_id
  for update;

  if not found then
    raise exception 'Comanda este invalidă pentru tenantul curent.';
  end if;

  if v_order.status = 'anulata' then
    raise exception 'Comanda anulată nu poate fi trimisă în livrare.';
  end if;

  if v_order.status = 'livrata' or v_order.linked_vanzare_id is not null then
    raise exception 'Comanda este deja livrată.';
  end if;

  select count(*), round(coalesce(sum(sr.cantitate_kg), 0)::numeric, 2)
  into v_reserved_count, v_reserved_kg
  from public.stock_reservations sr
  where sr.tenant_id = v_tenant_id
    and sr.comanda_id = v_order.id
    and sr.status = 'active';

  if v_order.status = 'in_livrare'
     and v_reserved_count > 0
     and v_reserved_kg = round(coalesce(v_order.cantitate_kg, 0)::numeric, 2) then
    return v_order;
  end if;

  if v_reserved_count > 0 then
    update public.stock_reservations
    set status = 'released',
        released_at = now()
    where tenant_id = v_tenant_id
      and comanda_id = v_order.id
      and status = 'active';
  end if;

  perform public.reserve_sellable_cal1_stock(
    v_tenant_id,
    'comanda',
    v_order.id,
    null,
    round(coalesce(v_order.cantitate_kg, 0)::numeric, 2),
    jsonb_build_object(
      'order_kind', coalesce(v_order.order_kind, 'manual'),
      'data_origin', v_order.data_origin,
      'reserved_via', 'set_comanda_in_delivery_with_reservation'
    )
  );

  update public.comenzi
  set status = 'in_livrare',
      updated_at = now()
  where id = v_order.id
    and tenant_id = v_tenant_id
  returning *
  into v_order;

  return v_order;
end;
$$;

create or replace function public.release_comanda_delivery_reservation(
  p_comanda_id uuid,
  p_next_status public.comanda_status
)
returns public.comenzi
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_order public.comenzi;
begin
  if v_user_id is null then
    raise exception 'Neautorizat';
  end if;

  select public.current_tenant_id()
  into v_tenant_id;

  if v_tenant_id is null then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  if not (public.is_tenant_owner(v_tenant_id) or public.operator_can_write('comenzi')) then
    raise exception 'forbidden_read_only';
  end if;

  if p_next_status not in ('confirmata', 'programata', 'anulata') then
    raise exception 'Statusul țintă este invalid pentru ieșirea din livrare.';
  end if;

  perform pg_advisory_xact_lock(hashtext('stock-mutation'), hashtext(v_tenant_id::text));

  select *
  into v_order
  from public.comenzi
  where id = p_comanda_id
    and tenant_id = v_tenant_id
  for update;

  if not found then
    raise exception 'Comanda este invalidă pentru tenantul curent.';
  end if;

  update public.stock_reservations
  set status = 'released',
      released_at = now()
  where tenant_id = v_tenant_id
    and comanda_id = v_order.id
    and status = 'active';

  update public.comenzi
  set status = p_next_status,
      updated_at = now()
  where id = v_order.id
    and tenant_id = v_tenant_id
  returning *
  into v_order;

  return v_order;
end;
$$;

create or replace function public.set_shop_order_in_delivery_with_reservation(
  p_shop_order_id uuid,
  p_delivery_date date default null
)
returns public.shop_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_shop_order public.shop_orders%rowtype;
  v_reserved_count integer := 0;
  v_reserved_kg numeric := 0;
  v_item jsonb;
  v_product_id text;
  v_product_name text;
  v_item_label text;
  v_qty_numeric numeric;
  v_qty integer;
  v_unit_weight_kg numeric;
  v_line_weight_kg numeric;
  v_total_kg numeric := 0;
begin
  if v_user_id is null then
    raise exception 'Neautorizat';
  end if;

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

  if v_shop_order.status = 'anulata' then
    raise exception 'Comanda anulată nu poate fi trimisă în livrare.';
  end if;

  if v_shop_order.status = 'livrata' then
    raise exception 'Comanda shop este deja livrată.';
  end if;

  select count(*), round(coalesce(sum(sr.cantitate_kg), 0)::numeric, 2)
  into v_reserved_count, v_reserved_kg
  from public.stock_reservations sr
  where sr.tenant_id = v_tenant_id
    and sr.shop_order_id = v_shop_order.id
    and sr.status = 'active';

  if v_reserved_count > 0 then
    update public.stock_reservations
    set status = 'released',
        released_at = now()
    where tenant_id = v_tenant_id
      and shop_order_id = v_shop_order.id
      and status = 'active';
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
  end loop;

  if v_total_kg <= 0 then
    raise exception 'Greutatea totală a comenzii trebuie să fie mai mare decât 0.';
  end if;

  if v_shop_order.status = 'in_livrare'
     and v_reserved_count > 0
     and v_reserved_kg = v_total_kg then
    return v_shop_order;
  end if;

  perform public.reserve_sellable_cal1_stock(
    v_tenant_id,
    'shop_order',
    null,
    v_shop_order.id,
    v_total_kg,
    jsonb_build_object(
      'reserved_via', 'set_shop_order_in_delivery_with_reservation',
      'customer_name', v_shop_order.customer_name
    )
  );

  update public.shop_orders
  set status = 'in_livrare',
      delivery_date = coalesce(p_delivery_date, delivery_date, public.bucharest_today())
  where id = v_shop_order.id
    and tenant_id = v_tenant_id
  returning *
  into v_shop_order;

  return v_shop_order;
end;
$$;

create or replace function public.release_shop_order_delivery_reservation(
  p_shop_order_id uuid,
  p_next_status text
)
returns public.shop_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_shop_order public.shop_orders%rowtype;
begin
  if v_user_id is null then
    raise exception 'Neautorizat';
  end if;

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

  if p_next_status not in ('confirmata', 'anulata') then
    raise exception 'Statusul țintă este invalid pentru ieșirea din livrare.';
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

  update public.stock_reservations
  set status = 'released',
      released_at = now()
  where tenant_id = v_tenant_id
    and shop_order_id = v_shop_order.id
    and status = 'active';

  update public.shop_orders
  set status = p_next_status
  where id = v_shop_order.id
    and tenant_id = v_tenant_id
  returning *
  into v_shop_order;

  return v_shop_order;
end;
$$;

create or replace function public.deliver_order_atomic(
  p_order_id uuid,
  p_delivered_qty numeric,
  p_payment_status text default 'Restanta',
  p_remaining_delivery_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_order public.comenzi;
  v_sale public.vanzari;
  v_delivered_order public.comenzi;
  v_remaining_order public.comenzi;
  v_sale_observatii text;
  v_delivered_qty numeric := round(greatest(coalesce(p_delivered_qty, 0), 0)::numeric, 2);
  v_current_qty numeric;
  v_remaining_qty numeric;
  v_total_available numeric;
  v_remaining_to_allocate numeric;
  v_take numeric;
  v_deducted_stock numeric := 0;
  v_today date := public.bucharest_today();
  v_remaining_date date;
  v_bucket record;
  v_active_reservation_count integer := 0;
  v_active_reserved_kg numeric := 0;
begin
  if v_user_id is null then
    raise exception 'Neautorizat';
  end if;

  select public.current_tenant_id()
  into v_tenant_id;

  if v_tenant_id is null then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  if not (public.is_tenant_owner(v_tenant_id) or public.operator_can_write('livrari')) then
    raise exception 'forbidden_read_only';
  end if;

  perform pg_advisory_xact_lock(hashtext('stock-mutation'), hashtext(v_tenant_id::text));

  select *
  into v_order
  from public.comenzi
  where id = p_order_id
    and tenant_id = v_tenant_id
  for update;

  if not found then
    raise exception 'Comanda este invalida pentru tenantul curent.';
  end if;

  v_current_qty := round(coalesce(v_order.cantitate_kg, 0)::numeric, 2);

  if v_delivered_qty <= 0 then
    raise exception 'Cantitatea livrata trebuie sa fie mai mare decat 0.';
  end if;

  if v_delivered_qty > v_current_qty then
    raise exception 'Cantitatea livrata nu poate depasi cantitatea comandata.';
  end if;

  if v_order.status = 'anulata' then
    raise exception 'Comanda anulata nu poate fi livrata.';
  end if;

  if v_order.status = 'livrata' or v_order.linked_vanzare_id is not null then
    raise exception 'Comanda este deja livrata.';
  end if;

  select count(*), round(coalesce(sum(sr.cantitate_kg), 0)::numeric, 2)
  into v_active_reservation_count, v_active_reserved_kg
  from public.stock_reservations sr
  where sr.tenant_id = v_tenant_id
    and sr.comanda_id = v_order.id
    and sr.status = 'active';

  if v_active_reservation_count > 0 and v_active_reserved_kg < v_delivered_qty then
    raise exception 'Rezervarea de stoc pentru comandă este incompletă.';
  end if;

  if v_active_reservation_count = 0 then
    select coalesce(sum(stock_bucket.available_kg), 0)
    into v_total_available
    from (
      select round(
        sum(
          case
            when ms.tip_miscare in ('vanzare', 'consum', 'oferit_gratuit', 'pierdere') then -coalesce(ms.cantitate_kg, 0)
            else coalesce(ms.cantitate_kg, 0)
          end
        )::numeric,
        2
      ) as available_kg
      from public.miscari_stoc ms
      where ms.tenant_id = v_tenant_id
        and ms.locatie_id is not null
        and ms.produs is not null
        and ms.calitate is not null
        and ms.depozit is not null
        and ms.tip_miscare is not null
        and ms.cantitate_kg is not null
      group by ms.locatie_id, ms.produs, ms.calitate, ms.depozit
      having sum(
        case
          when ms.tip_miscare in ('vanzare', 'consum', 'oferit_gratuit', 'pierdere') then -coalesce(ms.cantitate_kg, 0)
          else coalesce(ms.cantitate_kg, 0)
        end
      ) > 0
    ) as stock_bucket;

    if v_total_available < v_delivered_qty then
      raise exception 'Stoc insuficient pentru livrare.';
    end if;
  end if;

  v_sale_observatii := concat_ws(' | ', nullif(btrim(coalesce(v_order.observatii, '')), ''), format('Livrare comanda %s', v_order.id));

  insert into public.vanzari (
    tenant_id,
    client_sync_id,
    id_vanzare,
    data,
    client_id,
    comanda_id,
    cantitate_kg,
    pret_lei_kg,
    status_plata,
    observatii_ladite,
    sync_status,
    created_by,
    updated_by
  )
  values (
    v_tenant_id,
    gen_random_uuid(),
    public.generate_business_id('V'),
    v_today,
    v_order.client_id,
    v_order.id,
    v_delivered_qty,
    round(coalesce(v_order.pret_per_kg, 0)::numeric, 2),
    coalesce(nullif(btrim(coalesce(p_payment_status, '')), ''), 'Restanta'),
    nullif(btrim(v_sale_observatii), ''),
    'synced',
    v_user_id,
    v_user_id
  )
  returning *
  into v_sale;

  if v_active_reservation_count > 0 then
    v_deducted_stock := public.consume_active_stock_reservations_for_comanda(
      v_tenant_id,
      v_order.id,
      v_sale.id,
      v_delivered_qty,
      v_today,
      'Consum stoc prin livrare comanda'
    );

    if v_deducted_stock < v_delivered_qty then
      raise exception 'Consum de stoc incomplet din rezervări. Rezervat consumat=% kg, livrare=% kg',
        trim(to_char(coalesce(v_deducted_stock, 0), 'FM999999990.00')),
        trim(to_char(v_delivered_qty, 'FM999999990.00'));
    end if;
  else
    v_remaining_to_allocate := v_delivered_qty;

    for v_bucket in
      select
        ms.locatie_id,
        ms.produs,
        ms.calitate,
        ms.depozit,
        round(
          sum(
            case
              when ms.tip_miscare in ('vanzare', 'consum', 'oferit_gratuit', 'pierdere') then -coalesce(ms.cantitate_kg, 0)
              else coalesce(ms.cantitate_kg, 0)
            end
          )::numeric,
          2
        ) as available_kg
      from public.miscari_stoc ms
      where ms.tenant_id = v_tenant_id
        and ms.locatie_id is not null
        and ms.produs is not null
        and ms.calitate is not null
        and ms.depozit is not null
        and ms.tip_miscare is not null
        and ms.cantitate_kg is not null
      group by ms.locatie_id, ms.produs, ms.calitate, ms.depozit
      having sum(
        case
          when ms.tip_miscare in ('vanzare', 'consum', 'oferit_gratuit', 'pierdere') then -coalesce(ms.cantitate_kg, 0)
          else coalesce(ms.cantitate_kg, 0)
        end
      ) > 0
      order by available_kg desc
    loop
      exit when v_remaining_to_allocate <= 0;

      v_take := round(least(v_bucket.available_kg, v_remaining_to_allocate)::numeric, 2);
      if v_take <= 0 then
        continue;
      end if;

      insert into public.miscari_stoc (
        tenant_id,
        locatie_id,
        produs,
        calitate,
        depozit,
        tip_miscare,
        cantitate_kg,
        tip,
        cantitate_cal1,
        cantitate_cal2,
        referinta_id,
        data,
        observatii,
        descriere
      )
      values (
        v_tenant_id,
        v_bucket.locatie_id,
        v_bucket.produs,
        v_bucket.calitate,
        v_bucket.depozit,
        'vanzare',
        v_take,
        'vanzare',
        case when v_bucket.calitate = 'cal1' then -v_take else 0 end,
        case when v_bucket.calitate = 'cal2' then -v_take else 0 end,
        v_sale.id,
        v_today,
        'Consum stoc prin livrare comanda',
        'Consum stoc prin livrare comanda'
      );

      v_deducted_stock := round((v_deducted_stock + v_take)::numeric, 2);
      v_remaining_to_allocate := round((v_remaining_to_allocate - v_take)::numeric, 2);
    end loop;

    if v_remaining_to_allocate > 0 then
      raise exception 'Stoc insuficient pentru livrare.';
    end if;
  end if;

  update public.comenzi
  set status = 'livrata',
      linked_vanzare_id = v_sale.id,
      observatii = concat_ws(
        ' | ',
        nullif(btrim(coalesce(v_order.observatii, '')), ''),
        format('Livrata: %s kg', trim(to_char(v_delivered_qty, 'FM999999990.00')))
      ),
      updated_at = now()
  where id = v_order.id
    and tenant_id = v_tenant_id
  returning *
  into v_delivered_order;

  v_remaining_qty := round((v_current_qty - v_delivered_qty)::numeric, 2);

  if v_remaining_qty > 0 then
    v_remaining_date := coalesce(p_remaining_delivery_date, v_today + 1);

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
      parent_comanda_id,
      data_origin
    )
    values (
      v_tenant_id,
      v_order.client_id,
      v_order.client_nume_manual,
      v_order.telefon,
      v_order.locatie_livrare,
      v_today,
      v_remaining_date,
      v_remaining_qty,
      round(coalesce(v_order.pret_per_kg, 0)::numeric, 2),
      round((v_remaining_qty * coalesce(v_order.pret_per_kg, 0))::numeric, 2),
      coalesce(v_order.order_kind, 'manual'),
      case when v_remaining_date > v_today then 'programata' else 'confirmata' end,
      concat_ws(
        ' | ',
        nullif(btrim(coalesce(v_order.observatii, '')), ''),
        format('Rest din comanda %s', v_order.id)
      ),
      v_order.id,
      v_order.data_origin
    )
    returning *
    into v_remaining_order;

    if v_active_reservation_count > 0 then
      update public.stock_reservations
      set status = 'released',
          released_at = now()
      where tenant_id = v_tenant_id
        and comanda_id = v_order.id
        and status = 'active';
    end if;
  end if;

  return jsonb_build_object(
    'delivered_order', to_jsonb(v_delivered_order),
    'vanzare', to_jsonb(v_sale),
    'remaining_order', to_jsonb(v_remaining_order),
    'deducted_stock_kg', v_deducted_stock
  );
end;
$$;

create or replace function public.reopen_comanda_atomic(
  p_comanda_id uuid,
  p_tenant_id uuid default null
)
returns public.comenzi
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_current_tenant_id uuid;
  v_tenant_id uuid;
  v_order public.comenzi;
  v_reopened public.comenzi;
  v_reopen_status public.comanda_status;
  v_blocking_children integer := 0;
begin
  if v_user_id is null then
    raise exception 'Neautorizat';
  end if;

  select public.current_tenant_id()
  into v_current_tenant_id;

  if v_current_tenant_id is null then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  if p_tenant_id is not null and p_tenant_id <> v_current_tenant_id then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  v_tenant_id := v_current_tenant_id;

  if not (public.is_tenant_owner(v_tenant_id) or public.operator_can_write('comenzi')) then
    raise exception 'forbidden_read_only';
  end if;

  perform pg_advisory_xact_lock(hashtext('stock-mutation'), hashtext(v_tenant_id::text));

  select *
  into v_order
  from public.comenzi
  where id = p_comanda_id
    and tenant_id = v_tenant_id
  for update;

  if not found then
    raise exception 'Comanda este invalida pentru tenantul curent.';
  end if;

  if v_order.status <> 'livrata' then
    raise exception 'Doar comenzile livrate pot fi redeschise.';
  end if;

  select count(*)
  into v_blocking_children
  from public.comenzi child_order
  where child_order.tenant_id = v_tenant_id
    and child_order.parent_comanda_id = v_order.id
    and (
      child_order.linked_vanzare_id is not null
      or child_order.status = 'livrata'
    );

  if v_blocking_children > 0 then
    raise exception 'Comanda are livrari ulterioare si nu poate fi redeschisa.';
  end if;

  update public.stock_reservations
  set status = 'released',
      released_at = now(),
      linked_vanzare_id = null
  where tenant_id = v_tenant_id
    and comanda_id = v_order.id
    and (
      status = 'active'
      or (
        status = 'consumed'
        and v_order.linked_vanzare_id is not null
        and linked_vanzare_id = v_order.linked_vanzare_id
      )
    );

  if v_order.linked_vanzare_id is not null then
    perform public.delete_vanzare_with_stock(v_order.linked_vanzare_id);
  end if;

  delete from public.comenzi child_order
  where child_order.tenant_id = v_tenant_id
    and child_order.parent_comanda_id = v_order.id
    and child_order.linked_vanzare_id is null;

  v_reopen_status := case
    when v_order.data_livrare is not null and v_order.data_livrare > current_date
      then 'programata'::public.comanda_status
    else 'confirmata'::public.comanda_status
  end;

  update public.comenzi
  set status = v_reopen_status,
      linked_vanzare_id = null,
      updated_at = now(),
      observatii = concat_ws(
        ' | ',
        nullif(btrim(coalesce(v_order.observatii, '')), ''),
        'Comanda redeschisa'
      )
  where id = v_order.id
    and tenant_id = v_tenant_id
  returning *
  into v_reopened;

  return v_reopened;
end;
$$;

create or replace function public.delete_comanda_atomic(
  p_comanda_id uuid,
  p_tenant_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_current_tenant_id uuid;
  v_tenant_id uuid;
  v_order public.comenzi;
begin
  if v_user_id is null then
    raise exception 'Neautorizat';
  end if;

  select public.current_tenant_id()
  into v_current_tenant_id;

  if v_current_tenant_id is null then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  if p_tenant_id is not null and p_tenant_id <> v_current_tenant_id then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  v_tenant_id := v_current_tenant_id;

  if not public.is_tenant_owner(v_tenant_id) then
    raise exception 'forbidden_delete';
  end if;

  perform pg_advisory_xact_lock(hashtext('stock-mutation'), hashtext(v_tenant_id::text));

  select *
  into v_order
  from public.comenzi
  where id = p_comanda_id
    and tenant_id = v_tenant_id
  for update;

  if not found then
    raise exception 'Comanda este invalida pentru tenantul curent.';
  end if;

  update public.stock_reservations
  set status = 'released',
      released_at = now(),
      linked_vanzare_id = null
  where tenant_id = v_tenant_id
    and comanda_id = v_order.id
    and (
      status = 'active'
      or (
        status = 'consumed'
        and v_order.linked_vanzare_id is not null
        and linked_vanzare_id = v_order.linked_vanzare_id
      )
    );

  if v_order.linked_vanzare_id is not null then
    perform public.delete_vanzare_with_stock(v_order.linked_vanzare_id);
  end if;

  delete from public.comenzi
  where id = v_order.id
    and tenant_id = v_tenant_id;
end;
$$;

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

  if not (public.is_tenant_owner(v_tenant_id) or public.operator_can_write('livrari')) then
    raise exception 'forbidden_read_only';
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

  update public.stock_reservations
  set comanda_id = v_comanda.id
  where tenant_id = v_tenant_id
    and shop_order_id = v_shop_order.id
    and status = 'active'
    and comanda_id is null;

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

create or replace function public.deliver_shop_order_atomic_partial(
  p_shop_order_id uuid,
  p_delivered_kg numeric,
  p_payment_status text default 'platit',
  p_remaining_delivery_date date default null
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
  v_remaining_order public.comenzi%rowtype;
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
  v_delivered_kg numeric := round(greatest(coalesce(p_delivered_kg, 0), 0)::numeric, 2);
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

  if not (public.is_tenant_owner(v_tenant_id) or public.operator_can_write('livrari')) then
    raise exception 'forbidden_read_only';
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

    select child_order.*
    into v_remaining_order
    from public.comenzi child_order
    where child_order.parent_comanda_id = v_comanda.id
      and child_order.tenant_id = v_tenant_id
      and child_order.linked_vanzare_id is null
    order by child_order.created_at desc
    limit 1;

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
      'delivered_kg', v_comanda.cantitate_kg,
      'total_lei', v_comanda.total,
      'weight_snapshot', v_existing_link.weight_snapshot,
      'remaining_order', to_jsonb(v_remaining_order)
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

  if v_delivered_kg <= 0 then
    raise exception 'Cantitatea livrată trebuie să fie mai mare decât 0.';
  end if;

  if v_delivered_kg > v_total_kg then
    raise exception 'Cantitatea livrată nu poate depăși greutatea totală a comenzii.';
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

  update public.stock_reservations
  set comanda_id = v_comanda.id
  where tenant_id = v_tenant_id
    and shop_order_id = v_shop_order.id
    and status = 'active'
    and comanda_id is null;

  v_delivery_result := public.deliver_order_atomic(
    v_comanda.id,
    v_delivered_kg,
    coalesce(nullif(btrim(coalesce(p_payment_status, '')), ''), 'platit'),
    p_remaining_delivery_date
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
    'delivered_kg', v_delivered_kg,
    'total_lei', v_shop_order.total_lei,
    'weight_snapshot', v_weight_snapshot,
    'remaining_order', v_delivery_result->'remaining_order',
    'delivery', v_delivery_result
  );
end;
$$;

revoke all on function public.resolve_shop_order_total_kg_loose(jsonb) from public;
revoke all on function public.list_sellable_cal1_buckets_for_reservation(uuid) from public;
revoke all on function public.reserve_sellable_cal1_stock(uuid, text, uuid, uuid, numeric, jsonb) from public;
revoke all on function public.consume_active_stock_reservations_for_comanda(uuid, uuid, uuid, numeric, date, text) from public;

revoke all on function public.get_sellable_cal1_stock_summary(uuid) from public;
grant execute on function public.get_sellable_cal1_stock_summary(uuid) to authenticated, service_role;

revoke all on function public.set_comanda_in_delivery_with_reservation(uuid) from public;
grant execute on function public.set_comanda_in_delivery_with_reservation(uuid) to authenticated, service_role;

revoke all on function public.release_comanda_delivery_reservation(uuid, public.comanda_status) from public;
grant execute on function public.release_comanda_delivery_reservation(uuid, public.comanda_status) to authenticated, service_role;

revoke all on function public.set_shop_order_in_delivery_with_reservation(uuid, date) from public;
grant execute on function public.set_shop_order_in_delivery_with_reservation(uuid, date) to authenticated;

revoke all on function public.release_shop_order_delivery_reservation(uuid, text) from public;
grant execute on function public.release_shop_order_delivery_reservation(uuid, text) to authenticated;

revoke all on function public.deliver_order_atomic(uuid, numeric, text, date) from public;
revoke all on function public.delete_comanda_atomic(uuid, uuid) from public;
revoke all on function public.reopen_comanda_atomic(uuid, uuid) from public;
revoke all on function public.deliver_shop_order_atomic(uuid, text) from public;
revoke all on function public.deliver_shop_order_atomic_partial(uuid, numeric, text, date) from public;

grant execute on function public.deliver_order_atomic(uuid, numeric, text, date) to authenticated, service_role;
grant execute on function public.delete_comanda_atomic(uuid, uuid) to authenticated, service_role;
grant execute on function public.reopen_comanda_atomic(uuid, uuid) to authenticated, service_role;
grant execute on function public.deliver_shop_order_atomic(uuid, text) to authenticated;
grant execute on function public.deliver_shop_order_atomic_partial(uuid, numeric, text, date) to authenticated;

notify pgrst, 'reload schema';
