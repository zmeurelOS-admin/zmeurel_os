-- Derived stock pipeline for comenzi.
-- No data backfill and no destructive table mutations. Legacy stock ledgers remain read-only archives.

create table if not exists public.ajustari_stoc (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  data date not null default current_date,
  delta_kg numeric not null,
  tip text not null check (tip in ('pierdere', 'corectie_minus', 'corectie_plus', 'sold_initial', 'cal2_retras')),
  motiv text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists ajustari_stoc_tenant_idx
  on public.ajustari_stoc (tenant_id);

alter table public.ajustari_stoc enable row level security;

drop policy if exists ajustari_stoc_select on public.ajustari_stoc;
create policy ajustari_stoc_select
  on public.ajustari_stoc
  for select
  to authenticated
  using (tenant_id = public.current_tenant_id());

drop policy if exists ajustari_stoc_insert on public.ajustari_stoc;
create policy ajustari_stoc_insert
  on public.ajustari_stoc
  for insert
  to authenticated
  with check (
    tenant_id = public.current_tenant_id()
    and (public.is_tenant_owner(tenant_id) or public.operator_can_write('comenzi'))
  );

drop policy if exists ajustari_stoc_update on public.ajustari_stoc;
create policy ajustari_stoc_update
  on public.ajustari_stoc
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

drop policy if exists ajustari_stoc_delete on public.ajustari_stoc;
create policy ajustari_stoc_delete
  on public.ajustari_stoc
  for delete
  to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and public.is_tenant_owner(tenant_id)
  );

revoke all on table public.ajustari_stoc from anon;
grant select, insert, update, delete on table public.ajustari_stoc to authenticated;

alter table public.vanzari
  add column if not exists data_incasare date;

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
  v_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
  v_current_tenant_id uuid;
  v_tenant_id uuid;
  v_recoltat numeric := 0;
  v_livrat_comenzi numeric := 0;
  v_livrat_shop_nepromovat numeric := 0;
  v_in_livrare_comenzi numeric := 0;
  v_in_livrare_shop_nepromovat numeric := 0;
  v_ajustari numeric := 0;
  v_consumat numeric := 0;
  v_angajat numeric := 0;
  v_ledger numeric := 0;
  v_disponibil numeric := 0;
begin
  if auth.uid() is null and v_role <> 'service_role' then
    raise exception 'UNAUTHORIZED';
  end if;

  select public.current_tenant_id()
  into v_current_tenant_id;

  v_tenant_id := coalesce(p_tenant_id, v_current_tenant_id);

  if v_tenant_id is null then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  if v_role <> 'service_role'
     and (v_current_tenant_id is null or v_current_tenant_id <> v_tenant_id) then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  select round(coalesce(sum(r.kg_cal1), 0)::numeric, 2)
  into v_recoltat
  from public.recoltari r
  where r.tenant_id = v_tenant_id;

  select round(coalesce(sum(c.cantitate_kg), 0)::numeric, 2)
  into v_livrat_comenzi
  from public.comenzi c
  where c.tenant_id = v_tenant_id
    and c.status = 'livrata';

  select round(coalesce(sum(c.cantitate_kg), 0)::numeric, 2)
  into v_in_livrare_comenzi
  from public.comenzi c
  where c.tenant_id = v_tenant_id
    and c.status = 'in_livrare';

  select round(coalesce(sum(public.resolve_shop_order_total_kg_loose(shop_order.items)), 0)::numeric, 2)
  into v_livrat_shop_nepromovat
  from public.shop_orders shop_order
  where shop_order.tenant_id = v_tenant_id
    and shop_order.status = 'livrata'
    and not exists (
      select 1
      from public.shop_order_erp_links link
      where link.tenant_id = v_tenant_id
        and link.shop_order_id = shop_order.id
    );

  select round(coalesce(sum(public.resolve_shop_order_total_kg_loose(shop_order.items)), 0)::numeric, 2)
  into v_in_livrare_shop_nepromovat
  from public.shop_orders shop_order
  where shop_order.tenant_id = v_tenant_id
    and shop_order.status = 'in_livrare'
    and not exists (
      select 1
      from public.shop_order_erp_links link
      where link.tenant_id = v_tenant_id
        and link.shop_order_id = shop_order.id
    );

  select round(coalesce(sum(a.delta_kg), 0)::numeric, 2)
  into v_ajustari
  from public.ajustari_stoc a
  where a.tenant_id = v_tenant_id;

  v_consumat := round((v_livrat_comenzi + v_livrat_shop_nepromovat)::numeric, 2);
  v_angajat := round((v_in_livrare_comenzi + v_in_livrare_shop_nepromovat)::numeric, 2);
  v_ledger := round((v_recoltat - v_consumat + v_ajustari)::numeric, 2);
  v_disponibil := round((v_ledger - v_angajat)::numeric, 2);

  return query
  select
    v_recoltat,
    v_consumat,
    v_angajat,
    0::numeric,
    v_ledger,
    v_disponibil;
end;
$$;

create or replace function public.set_comanda_in_delivery(
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
  v_summary record;
  v_required numeric;
  v_available numeric;
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

  if v_order.status = 'in_livrare' then
    return v_order;
  end if;

  if v_order.status = 'anulata' then
    raise exception 'Comanda anulată nu poate fi trimisă în livrare.';
  end if;

  if v_order.status = 'livrata' or v_order.linked_vanzare_id is not null then
    raise exception 'Comanda este deja livrată.';
  end if;

  v_required := round(coalesce(v_order.cantitate_kg, 0)::numeric, 2);

  if v_required <= 0 then
    raise exception 'Cantitatea comenzii trebuie să fie mai mare decât 0.';
  end if;

  select *
  into v_summary
  from public.get_sellable_cal1_stock_summary(v_tenant_id);

  v_available := round(coalesce(v_summary.disponibil_cal1_kg, 0)::numeric, 2);

  if v_required > v_available then
    raise exception 'STOC_INSUFICIENT'
      using
        detail = format('necesar=%s;disponibil=%s', v_required, v_available),
        errcode = 'P0001';
  end if;

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

create or replace function public.set_comanda_delivered(
  p_comanda_id uuid,
  p_delivered_qty numeric default null,
  p_status_plata text default 'platit'
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
  v_delivered_order public.comenzi;
  v_remaining_order public.comenzi;
  v_existing_sale public.vanzari;
  v_sale public.vanzari;
  v_sale_observatii text;
  v_current_qty numeric;
  v_delivered_qty numeric;
  v_remaining_qty numeric;
  v_today date := public.bucharest_today();
  v_summary record;
  v_available numeric;
begin
  if v_user_id is null then
    raise exception 'Neautorizat';
  end if;

  if p_status_plata is null or p_status_plata not in ('platit', 'neplatit') then
    raise exception 'Status plată invalid.';
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

  if v_order.status = 'livrata' and v_order.linked_vanzare_id is not null then
    select *
    into v_existing_sale
    from public.vanzari
    where id = v_order.linked_vanzare_id
      and tenant_id = v_tenant_id;

    select *
    into v_remaining_order
    from public.comenzi
    where tenant_id = v_tenant_id
      and parent_comanda_id = v_order.id
      and linked_vanzare_id is null
    order by created_at desc
    limit 1;

    return jsonb_build_object(
      'already_delivered', true,
      'delivered_order', to_jsonb(v_order),
      'vanzare', to_jsonb(v_existing_sale),
      'remaining_order', to_jsonb(v_remaining_order),
      'deducted_stock_kg', 0
    );
  end if;

  if v_order.status = 'anulata' then
    raise exception 'Comanda anulată nu poate fi livrată.';
  end if;

  if v_order.linked_vanzare_id is not null then
    raise exception 'Comanda este deja livrată.';
  end if;

  v_current_qty := round(coalesce(v_order.cantitate_kg, 0)::numeric, 2);
  v_delivered_qty := round(coalesce(p_delivered_qty, v_current_qty)::numeric, 2);

  if v_delivered_qty <= 0 then
    raise exception 'Cantitatea livrată trebuie să fie mai mare decât 0.';
  end if;

  if v_delivered_qty > v_current_qty then
    raise exception 'Cantitatea livrată nu poate depăși cantitatea comandată.';
  end if;

  if v_order.status <> 'in_livrare' then
    select *
    into v_summary
    from public.get_sellable_cal1_stock_summary(v_tenant_id);

    v_available := round(coalesce(v_summary.disponibil_cal1_kg, 0)::numeric, 2);

    if v_delivered_qty > v_available then
      raise exception 'STOC_INSUFICIENT'
        using
          detail = format('necesar=%s;disponibil=%s', v_delivered_qty, v_available),
          errcode = 'P0001';
    end if;
  end if;

  v_remaining_qty := round((v_current_qty - v_delivered_qty)::numeric, 2);
  v_sale_observatii := concat_ws(
    ' | ',
    nullif(btrim(coalesce(v_order.observatii, '')), ''),
    format('Livrare comanda %s', v_order.id)
  );

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
    data_incasare,
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
    p_status_plata,
    case when p_status_plata = 'platit' then v_today else null end,
    nullif(btrim(v_sale_observatii), ''),
    'synced',
    v_user_id,
    v_user_id
  )
  returning *
  into v_sale;

  update public.comenzi
  set cantitate_kg = v_delivered_qty,
      total = round((v_delivered_qty * coalesce(v_order.pret_per_kg, 0))::numeric, 2),
      status = 'livrata',
      linked_vanzare_id = v_sale.id,
      data_livrare = coalesce(v_order.data_livrare, v_today),
      observatii = concat_ws(
        ' | ',
        nullif(btrim(coalesce(v_order.observatii, '')), ''),
        format('Livrată: %s kg', trim(to_char(v_delivered_qty, 'FM999999990.00')))
      ),
      updated_at = now()
  where id = v_order.id
    and tenant_id = v_tenant_id
  returning *
  into v_delivered_order;

  if v_remaining_qty > 0 then
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
      coalesce(v_order.data_livrare, v_today + 1),
      v_remaining_qty,
      round(coalesce(v_order.pret_per_kg, 0)::numeric, 2),
      round((v_remaining_qty * coalesce(v_order.pret_per_kg, 0))::numeric, 2),
      coalesce(v_order.order_kind, 'manual'),
      'confirmata',
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
  end if;

  return jsonb_build_object(
    'already_delivered', false,
    'delivered_order', to_jsonb(v_delivered_order),
    'vanzare', to_jsonb(v_sale),
    'remaining_order', to_jsonb(v_remaining_order),
    'deducted_stock_kg', 0
  );
end;
$$;

create or replace function public.mark_comanda_incasata(
  p_comanda_id uuid
)
returns public.vanzari
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_order public.comenzi;
  v_sale public.vanzari;
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

  select *
  into v_order
  from public.comenzi
  where id = p_comanda_id
    and tenant_id = v_tenant_id
  for update;

  if not found then
    raise exception 'Comanda este invalidă pentru tenantul curent.';
  end if;

  if v_order.status <> 'livrata' or v_order.linked_vanzare_id is null then
    raise exception 'Comanda nu este livrată.';
  end if;

  select *
  into v_sale
  from public.vanzari
  where id = v_order.linked_vanzare_id
    and tenant_id = v_tenant_id
  for update;

  if not found then
    raise exception 'Vânzarea legată nu a fost găsită.';
  end if;

  if v_sale.status_plata = 'platit' then
    return v_sale;
  end if;

  update public.vanzari
  set status_plata = 'platit',
      data_incasare = coalesce(data_incasare, public.bucharest_today()),
      updated_at = now()
  where id = v_order.linked_vanzare_id
    and tenant_id = v_tenant_id
  returning *
  into v_sale;

  return v_sale;
end;
$$;

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

  if v_shop_order.status = 'anulata' then
    raise exception 'Comanda shop anulată nu poate fi promovată.';
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
    coalesce(v_shop_order.delivery_date, v_today),
    v_total_kg,
    v_price_per_kg,
    v_shop_order.total_lei,
    'confirmata',
    concat_ws(
      ' | ',
      format('Comandă shop %s', v_shop_order.id),
      nullif(btrim(coalesce(v_shop_order.notes, '')), '')
    ),
    'shop_order_bridge'
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

create or replace function public.set_shop_order_in_delivery(
  p_shop_order_id uuid,
  p_delivery_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_comanda public.comenzi;
  v_updated_comanda public.comenzi;
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
    into v_comanda
    from public.promote_shop_order_to_comanda(p_shop_order_id);
  v_updated_comanda := public.set_comanda_in_delivery(v_comanda.id);

  update public.shop_orders
  set status = 'in_livrare',
      delivery_date = coalesce(p_delivery_date, delivery_date, public.bucharest_today())
  where id = p_shop_order_id
    and tenant_id = v_tenant_id;

  return jsonb_build_object(
    'shop_order_id', p_shop_order_id,
    'comanda_id', v_updated_comanda.id,
    'comanda', to_jsonb(v_updated_comanda)
  );
end;
$$;

create or replace function public.set_shop_order_delivered(
  p_shop_order_id uuid,
  p_delivered_qty numeric default null,
  p_status_plata text default 'platit'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_comanda public.comenzi;
  v_delivery jsonb;
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
    into v_comanda
    from public.promote_shop_order_to_comanda(p_shop_order_id);
  v_delivery := public.set_comanda_delivered(
    v_comanda.id,
    p_delivered_qty,
    p_status_plata
  );

  update public.shop_orders
  set status = 'livrata',
      delivery_date = coalesce(delivery_date, public.bucharest_today())
  where id = p_shop_order_id
    and tenant_id = v_tenant_id;

  update public.shop_campaign_milestone_rewards
  set status = 'validated'
  where order_id = p_shop_order_id
    and status = 'pending';

  return jsonb_build_object(
    'shop_order_id', p_shop_order_id,
    'comanda_id', v_comanda.id,
    'delivery', v_delivery,
    'remaining_order', v_delivery->'remaining_order'
  );
end;
$$;

revoke all on function public.get_sellable_cal1_stock_summary(uuid) from public;
revoke all on function public.get_sellable_cal1_stock_summary(uuid) from anon;
grant execute on function public.get_sellable_cal1_stock_summary(uuid) to authenticated, service_role;

revoke all on function public.set_comanda_in_delivery(uuid) from public;
revoke all on function public.set_comanda_delivered(uuid, numeric, text) from public;
revoke all on function public.set_comanda_delivered(uuid, numeric, text) from anon;
revoke all on function public.mark_comanda_incasata(uuid) from public;
revoke all on function public.mark_comanda_incasata(uuid) from anon;
revoke all on function public.promote_shop_order_to_comanda(uuid) from public;
revoke all on function public.set_shop_order_in_delivery(uuid, date) from public;
revoke all on function public.set_shop_order_delivered(uuid, numeric, text) from public;
revoke all on function public.set_shop_order_delivered(uuid, numeric, text) from anon;

grant execute on function public.get_sellable_cal1_stock_summary(uuid) to authenticated, service_role;
grant execute on function public.set_comanda_in_delivery(uuid) to authenticated, service_role;
grant execute on function public.set_comanda_delivered(uuid, numeric, text) to authenticated, service_role;
grant execute on function public.mark_comanda_incasata(uuid) to authenticated, service_role;
grant execute on function public.promote_shop_order_to_comanda(uuid) to authenticated, service_role;
grant execute on function public.set_shop_order_in_delivery(uuid, date) to authenticated, service_role;
grant execute on function public.set_shop_order_delivered(uuid, numeric, text) to authenticated, service_role;

notify pgrst, 'reload schema';;
