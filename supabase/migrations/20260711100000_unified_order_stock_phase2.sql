-- Faza 2 unificare comenzi + stoc derivat (2026-07-11).
-- DOAR schemă și funcții — nu modifică date. Migrările de date sunt separate
-- (20260711110000..2) și se aplică DUPĂ această migrație.
--
-- Conținut:
--  1. ajustari_stoc: CHECK nou pe tip + scriere DOAR prin RPC (se revocă INSERT/UPDATE/DELETE direct).
--  2. create_ajustare_stoc(...) — RPC nou cu gardă anti-negativ pe disponibilul derivat.
--  3. resolve_zmeura_produs_id(uuid) — helper pentru comenzi.produs_id.
--  4. promote_shop_order_to_comanda — poate rula și cu service_role (checkout public),
--     oglindește statusul inițial al shop order-ului, populează produs_id,
--     propagă order_kind ('cadou'/'consum_propriu' păstrate, restul 'manual') și
--     acceptă comenzi gratuite (total_lei >= 0; pret_per_kg = 0, compatibil cu
--     constraint-ul live pret_per_kg >= 0) — confirmate în uz (2/55 pe producție).
--  5. set_comanda_delivered — comanda deja `livrata` e idempotentă chiar fără vânzare legată
--     (protejează comenzile istorice migrate) + produs_id pe comanda-rest.
--  6. sync_shop_order_bridge_status — tranzițiile noua/confirmata/anulata se propagă pe
--     comanda bridge (fix R2: anularea eliberează stocul angajat).
--  7. resync_shop_order_bridge_qty — R3: resincronizează cantitatea bridge-ului după editarea items.
--  8. create/update/delete_recoltare_with_stock — nu mai scriu în miscari_stoc; gărzile
--     anti-negativ folosesc disponibilul derivat (get_sellable_cal1_stock_summary).
--  9. Comentariu pe comenzi.stock_deducted (folosit doar de modulul Asociație).
--
-- NU se modifică: formula get_sellable_cal1_stock_summary (verificată — un shop order CU link
-- ERP este exclus din termenii "nepromovat" prin NOT EXISTS pe shop_order_erp_links și contat
-- o singură dată prin statusul comenzii bridge; un shop order FĂRĂ link rămâne contat prin
-- termenii shop. Nicio dublă numărare în ambele sensuri.)
-- NU se atinge: trigger-ul prevent_negative_stock (rămâne pe arhiva miscari_stoc, devine inert),
-- modulul Asociație, tabelul miscari_stoc (arhivă înghețată).

-- ---------------------------------------------------------------------------
-- 1. ajustari_stoc: CHECK nou + scriere doar prin RPC
-- ---------------------------------------------------------------------------
-- Tabela este goală în producție (verificat 2026-07-11), deci înlocuirea CHECK-ului e sigură.
alter table public.ajustari_stoc
  drop constraint if exists ajustari_stoc_tip_check;

alter table public.ajustari_stoc
  add constraint ajustari_stoc_tip_check check (
    tip in ('congelat', 'procesat', 'pierdere', 'consum_propriu', 'corectie_plus', 'corectie_minus', 'altul')
  );

comment on table public.ajustari_stoc is
  'Jurnal de ajustări ale stocului derivat de zmeură cal1. Scrierea se face EXCLUSIV prin RPC-ul create_ajustare_stoc (validare anti-negativ + advisory lock). Tipurile congelat/procesat/pierdere/consum_propriu/corectie_minus/altul sunt scăderi (delta_kg < 0); corectie_plus e adaos (delta_kg > 0). Nu există stoc separat de congelată/procesată — doar evidență.';

-- RLS: rămâne DOAR SELECT pentru tenant. INSERT/UPDATE/DELETE direct se revocă —
-- singura cale de scriere este RPC-ul security definer (fix R5).
drop policy if exists ajustari_stoc_insert on public.ajustari_stoc;
drop policy if exists ajustari_stoc_update on public.ajustari_stoc;
drop policy if exists ajustari_stoc_delete on public.ajustari_stoc;

revoke insert, update, delete on table public.ajustari_stoc from authenticated;

-- Corecțiile de ajustări greșite se fac prin ajustări compensatorii
-- (corectie_plus / corectie_minus), nu prin UPDATE/DELETE — jurnalul e append-only.

-- ---------------------------------------------------------------------------
-- 2. create_ajustare_stoc — RPC nou
-- ---------------------------------------------------------------------------
create or replace function public.create_ajustare_stoc(
  p_tip text,
  p_delta_kg numeric,
  p_motiv text default null,
  p_data date default null
)
returns public.ajustari_stoc
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_delta numeric := round(coalesce(p_delta_kg, 0)::numeric, 2);
  v_summary record;
  v_available numeric;
  v_row public.ajustari_stoc;
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

  if p_tip is null or p_tip not in ('congelat', 'procesat', 'pierdere', 'consum_propriu', 'corectie_plus', 'corectie_minus', 'altul') then
    raise exception 'Tip ajustare invalid.';
  end if;

  if v_delta = 0 then
    raise exception 'Cantitatea ajustării trebuie să fie diferită de 0.';
  end if;

  if p_tip = 'corectie_plus' and v_delta <= 0 then
    raise exception 'Ajustarea de tip corectie_plus trebuie să aibă cantitate pozitivă.';
  end if;

  if p_tip <> 'corectie_plus' and v_delta >= 0 then
    raise exception 'Ajustarea de tip % este o scădere: cantitatea trebuie să fie negativă.', p_tip;
  end if;

  perform pg_advisory_xact_lock(hashtext('stock-mutation'), hashtext(v_tenant_id::text));

  if v_delta < 0 then
    select *
    into v_summary
    from public.get_sellable_cal1_stock_summary(v_tenant_id);

    v_available := round(coalesce(v_summary.disponibil_cal1_kg, 0)::numeric, 2);

    if v_available + v_delta < 0 then
      raise exception 'STOC_INSUFICIENT'
        using
          detail = format('necesar=%s;disponibil=%s', abs(v_delta), v_available),
          errcode = 'P0001';
    end if;
  end if;

  insert into public.ajustari_stoc (
    tenant_id,
    data,
    delta_kg,
    tip,
    motiv,
    created_by
  )
  values (
    v_tenant_id,
    coalesce(p_data, public.bucharest_today()),
    v_delta,
    p_tip,
    nullif(btrim(coalesce(p_motiv, '')), ''),
    v_user_id
  )
  returning *
  into v_row;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. resolve_zmeura_produs_id — helper pentru comenzi.produs_id
-- ---------------------------------------------------------------------------
-- Rezolvă dinamic produsul "Zmeură proaspătă" al tenantului (fără hardcodare de ID).
-- Returnează NULL dacă tenantul nu are un astfel de produs (ex. tenanți demo).
create or replace function public.resolve_zmeura_produs_id(
  p_tenant_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.produse p
  where p.tenant_id = p_tenant_id
    and (p.nume = 'Zmeură proaspătă' or lower(p.nume) like 'zmeur%')
  order by
    case when p.nume = 'Zmeură proaspătă' then 0 else 1 end,
    case when p.status = 'activ' then 0 else 1 end,
    p.created_at asc
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- 4. promote_shop_order_to_comanda — service-role aware + status oglindit + produs_id
-- ---------------------------------------------------------------------------
-- Schimbări față de 20260626000005:
--  * poate rula cu service_role (checkout public /api/shop/b2c/order, fără auth.uid());
--    în acest caz tenantul se ia din rândul shop_orders, nu din current_tenant_id().
--  * statusul inițial al comenzii bridge oglindește statusul shop order-ului
--    ('noua' -> 'noua', altfel 'confirmata'; tranzițiile in_livrare/livrata sunt aplicate
--    de RPC-urile dedicate care apelează promote în continuare, idempotent).
--  * populează comenzi.produs_id cu produsul "Zmeură proaspătă" al tenantului.
--  * ia advisory lock-ul de stoc (reentrant pentru apelanții care îl dețin deja).
--  * acceptă comenzi gratuite: total_lei >= 0 (respinge doar negativ), pret_per_kg
--    iese 0 natural — altfel un cadou/consum propriu din shop ar eșua fatal la
--    in_livrare, exact blocajul manual pe care unificarea îl elimină.
--  * propagă order_kind din shop_orders în comanda bridge ('cadou' și
--    'consum_propriu' păstrate ca atare; 'manual'/'standard'/'preorder'/NULL
--    normalizate la 'manual' — setul suportat de comenzi), ca în backfill-ul
--    20260711110001.
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

  -- Valoarea poate fi 0 (cadou / consum propriu), dar nu negativă;
  -- pret_per_kg iese 0 natural (constraint live: pret_per_kg >= 0).
  if coalesce(v_shop_order.total_lei, 0) < 0 then
    raise exception 'Valoarea comenzii nu poate fi negativă.';
  end if;

  v_price_per_kg := round((coalesce(v_shop_order.total_lei, 0)::numeric / v_total_kg)::numeric, 2);

  v_initial_status := case
    when v_shop_order.status = 'noua' then 'noua'
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

-- ---------------------------------------------------------------------------
-- 5. set_comanda_delivered — idempotent pe status 'livrata' + produs_id pe rest
-- ---------------------------------------------------------------------------
-- Schimbări față de 20260626000005:
--  * o comandă cu status 'livrata' este tratată ca deja livrată chiar dacă nu are
--    linked_vanzare_id (cazul comenzilor istorice migrate din shop) — previne crearea
--    unei vânzări duplicat și orice re-deducere;
--  * comanda-rest (livrare parțială) moștenește produs_id.
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

  if v_order.status = 'livrata' then
    if v_order.linked_vanzare_id is not null then
      select *
      into v_existing_sale
      from public.vanzari
      where id = v_order.linked_vanzare_id
        and tenant_id = v_tenant_id;
    end if;

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
      data_origin,
      produs_id
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
      v_order.data_origin,
      v_order.produs_id
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

-- ---------------------------------------------------------------------------
-- 6. sync_shop_order_bridge_status — fix R2
-- ---------------------------------------------------------------------------
-- Tranzițiile de status noua/confirmata/anulata ale unui shop order se propagă
-- atomic pe comanda bridge din `comenzi`, sub advisory lock. Ieșirea din
-- 'in_livrare' eliberează implicit stocul angajat (statusul comenzii iese din
-- termenul v_angajat al sumarului derivat).
-- Pentru 'in_livrare' folosește set_shop_order_in_delivery; pentru 'livrata'
-- folosește set_shop_order_delivered.
create or replace function public.sync_shop_order_bridge_status(
  p_shop_order_id uuid,
  p_next_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_shop_order public.shop_orders%rowtype;
  v_link public.shop_order_erp_links%rowtype;
  v_comanda public.comenzi;
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

  if p_next_status is null or p_next_status not in ('noua', 'confirmata', 'anulata') then
    raise exception 'Status invalid pentru sincronizarea shop order-ului.';
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
  into v_link
  from public.shop_order_erp_links link
  where link.shop_order_id = v_shop_order.id
    and link.tenant_id = v_tenant_id;

  if found then
    select *
    into v_comanda
    from public.comenzi
    where id = v_link.comanda_id
      and tenant_id = v_tenant_id
    for update;

    if found then
      if v_comanda.status = 'livrata' or v_comanda.linked_vanzare_id is not null then
        raise exception 'Comanda livrată nu poate fi modificată din shop. Redeschide comanda mai întâi.';
      end if;

      update public.comenzi
      set status = p_next_status,
          updated_at = now()
      where id = v_comanda.id
        and tenant_id = v_tenant_id
      returning *
      into v_comanda;
    end if;
  end if;

  update public.shop_orders
  set status = p_next_status
  where id = v_shop_order.id
    and tenant_id = v_tenant_id
  returning *
  into v_shop_order;

  return jsonb_build_object(
    'shop_order_id', v_shop_order.id,
    'shop_order_status', v_shop_order.status,
    'comanda_id', v_comanda.id,
    'comanda_status', v_comanda.status
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. resync_shop_order_bridge_qty — fix R3
-- ---------------------------------------------------------------------------
-- După editarea items pe un shop order cu link ERP, recalculează kg/preț/total pe
-- comanda bridge. Refuză editarea pentru comenzi în livrare sau livrate (ruta
-- API blochează separat editarea items când shop order-ul e 'in_livrare').
-- Acceptă comenzi gratuite (total_lei >= 0), simetric cu promote_shop_order_to_comanda.
create or replace function public.resync_shop_order_bridge_qty(
  p_shop_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_shop_order public.shop_orders%rowtype;
  v_link public.shop_order_erp_links%rowtype;
  v_comanda public.comenzi;
  v_total_kg numeric;
  v_price_per_kg numeric;
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

  select link.*
  into v_link
  from public.shop_order_erp_links link
  where link.shop_order_id = v_shop_order.id
    and link.tenant_id = v_tenant_id;

  if not found then
    return jsonb_build_object('synced', false, 'reason', 'no_bridge');
  end if;

  select *
  into v_comanda
  from public.comenzi
  where id = v_link.comanda_id
    and tenant_id = v_tenant_id
  for update;

  if not found then
    return jsonb_build_object('synced', false, 'reason', 'bridge_missing');
  end if;

  if v_comanda.status = 'livrata' or v_comanda.linked_vanzare_id is not null then
    raise exception 'Comanda livrată nu mai poate fi modificată.';
  end if;

  if v_comanda.status = 'in_livrare' then
    raise exception 'Retrogradează comanda din livrare înainte de a modifica produsele.';
  end if;

  v_total_kg := public.resolve_shop_order_total_kg_loose(v_shop_order.items);

  if v_total_kg <= 0 then
    raise exception 'Greutatea totală a comenzii trebuie să fie mai mare decât 0.';
  end if;

  -- Valoarea poate fi 0 (cadou / consum propriu), dar nu negativă —
  -- simetric cu promote_shop_order_to_comanda.
  if coalesce(v_shop_order.total_lei, 0) < 0 then
    raise exception 'Valoarea comenzii nu poate fi negativă.';
  end if;

  v_price_per_kg := round((coalesce(v_shop_order.total_lei, 0)::numeric / v_total_kg)::numeric, 2);

  update public.comenzi
  set cantitate_kg = v_total_kg,
      pret_per_kg = v_price_per_kg,
      total = coalesce(v_shop_order.total_lei, 0),
      updated_at = now()
  where id = v_comanda.id
    and tenant_id = v_tenant_id
  returning *
  into v_comanda;

  return jsonb_build_object(
    'synced', true,
    'comanda_id', v_comanda.id,
    'cantitate_kg', v_comanda.cantitate_kg,
    'pret_per_kg', v_comanda.pret_per_kg
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Recoltări: fără scrieri în miscari_stoc + gardă pe disponibilul derivat
-- ---------------------------------------------------------------------------
-- sync_recoltare_stock_movements NU se mai apelează (rămâne definită doar pentru
-- rollback). Disponibilul derivat citește recoltari.kg_cal1 direct, deci scrierile
-- în miscari_stoc erau redundante. miscari_stoc devine arhivă înghețată.

create or replace function public.create_recoltare_with_stock(
  p_data date,
  p_parcela_id uuid,
  p_culegator_id uuid,
  p_kg_cal1 numeric default 0,
  p_kg_cal2 numeric default 0,
  p_observatii text default null,
  p_tenant_id uuid default null
)
returns public.recoltari
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_tarif numeric;
  v_kg_cal1 numeric := round(greatest(coalesce(p_kg_cal1, 0), 0)::numeric, 2);
  v_kg_cal2 numeric := round(greatest(coalesce(p_kg_cal2, 0), 0)::numeric, 2);
  v_total_kg numeric := round((greatest(coalesce(p_kg_cal1, 0), 0) + greatest(coalesce(p_kg_cal2, 0), 0))::numeric, 2);
  v_valoare_munca numeric;
  v_recoltare public.recoltari;
begin
  if v_user_id is null then
    raise exception 'Neautorizat';
  end if;

  select public.current_tenant_id()
  into v_tenant_id;

  if v_tenant_id is null then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  if p_tenant_id is not null and p_tenant_id <> v_tenant_id then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  if not (public.is_tenant_owner(v_tenant_id) or public.operator_can_write('recoltari')) then
    raise exception 'forbidden_read_only';
  end if;

  perform pg_advisory_xact_lock(hashtext('stock-mutation'), hashtext(v_tenant_id::text));

  perform 1
  from public.parcele p
  where p.id = p_parcela_id
    and p.tenant_id = v_tenant_id;

  if not found then
    raise exception 'Parcela este invalida pentru tenantul curent.';
  end if;

  select c.tarif_lei_kg
  into v_tarif
  from public.culegatori c
  where c.id = p_culegator_id
    and c.tenant_id = v_tenant_id;

  if v_tarif is null then
    raise exception 'Culegatorul nu are tarif setat in profil';
  end if;

  v_valoare_munca := round((v_total_kg * v_tarif)::numeric, 2);

  insert into public.recoltari (
    tenant_id,
    id_recoltare,
    data,
    parcela_id,
    culegator_id,
    kg_cal1,
    kg_cal2,
    pret_lei_pe_kg_snapshot,
    valoare_munca_lei,
    observatii
  )
  values (
    v_tenant_id,
    public.generate_business_id('REC'),
    p_data,
    p_parcela_id,
    p_culegator_id,
    v_kg_cal1,
    v_kg_cal2,
    round(v_tarif::numeric, 2),
    v_valoare_munca,
    nullif(btrim(coalesce(p_observatii, '')), '')
  )
  returning *
  into v_recoltare;

  return v_recoltare;
end;
$$;

create or replace function public.update_recoltare_with_stock(
  p_recoltare_id uuid,
  p_data date,
  p_parcela_id uuid,
  p_culegator_id uuid,
  p_kg_cal1 numeric default 0,
  p_kg_cal2 numeric default 0,
  p_observatii text default null
)
returns public.recoltari
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_tarif numeric;
  v_kg_cal1 numeric := round(greatest(coalesce(p_kg_cal1, 0), 0)::numeric, 2);
  v_kg_cal2 numeric := round(greatest(coalesce(p_kg_cal2, 0), 0)::numeric, 2);
  v_total_kg numeric := round((greatest(coalesce(p_kg_cal1, 0), 0) + greatest(coalesce(p_kg_cal2, 0), 0))::numeric, 2);
  v_valoare_munca numeric;
  v_recoltare public.recoltari;
  v_current_recoltare public.recoltari;
  v_delta_cal1 numeric;
  v_summary record;
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

  if not (public.is_tenant_owner(v_tenant_id) or public.operator_can_write('recoltari')) then
    raise exception 'forbidden_read_only';
  end if;

  perform pg_advisory_xact_lock(hashtext('stock-mutation'), hashtext(v_tenant_id::text));

  select *
  into v_current_recoltare
  from public.recoltari r
  where r.id = p_recoltare_id
    and r.tenant_id = v_tenant_id
  for update;

  if not found then
    raise exception 'Recoltarea este invalida pentru tenantul curent.';
  end if;

  perform 1
  from public.parcele p
  where p.id = p_parcela_id
    and p.tenant_id = v_tenant_id;

  if not found then
    raise exception 'Parcela este invalida pentru tenantul curent.';
  end if;

  select c.tarif_lei_kg
  into v_tarif
  from public.culegatori c
  where c.id = p_culegator_id
    and c.tenant_id = v_tenant_id;

  if v_tarif is null then
    raise exception 'Culegatorul nu are tarif setat in profil';
  end if;

  -- Gardă anti-negativ pe sursa derivată: reducerea kg_cal1 nu poate coborî
  -- disponibilul sub 0 (echivalentul verificării vechi pe miscari_stoc).
  v_delta_cal1 := round((v_kg_cal1 - coalesce(v_current_recoltare.kg_cal1, 0))::numeric, 2);

  if v_delta_cal1 < 0 then
    select *
    into v_summary
    from public.get_sellable_cal1_stock_summary(v_tenant_id);

    v_available := round(coalesce(v_summary.disponibil_cal1_kg, 0)::numeric, 2);

    if v_available + v_delta_cal1 < 0 then
      raise exception 'insufficient_stock_after_edit'
        using hint = 'Stocul ar deveni negativ după editare. Există comenzi care depind de această recoltare.';
    end if;
  end if;

  v_valoare_munca := round((v_total_kg * v_tarif)::numeric, 2);

  update public.recoltari
  set data = p_data,
      parcela_id = p_parcela_id,
      culegator_id = p_culegator_id,
      kg_cal1 = v_kg_cal1,
      kg_cal2 = v_kg_cal2,
      pret_lei_pe_kg_snapshot = round(v_tarif::numeric, 2),
      valoare_munca_lei = v_valoare_munca,
      observatii = nullif(btrim(coalesce(p_observatii, '')), ''),
      updated_at = now()
  where id = p_recoltare_id
    and tenant_id = v_tenant_id
  returning *
  into v_recoltare;

  return v_recoltare;
end;
$$;

create or replace function public.delete_recoltare_with_stock(
  p_recoltare_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_recoltare public.recoltari;
  v_kg_cal1 numeric;
  v_summary record;
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

  if not public.is_tenant_owner(v_tenant_id) then
    raise exception 'forbidden_delete';
  end if;

  perform pg_advisory_xact_lock(hashtext('stock-mutation'), hashtext(v_tenant_id::text));

  select *
  into v_recoltare
  from public.recoltari r
  where r.id = p_recoltare_id
    and r.tenant_id = v_tenant_id
  for update;

  if not found then
    raise exception 'Recoltarea este invalida pentru tenantul curent.';
  end if;

  -- Gardă anti-negativ pe sursa derivată (păstrăm codul de eroare pe care
  -- îl așteaptă frontend-ul: cannot_delete_harvested_stock).
  v_kg_cal1 := round(coalesce(v_recoltare.kg_cal1, 0)::numeric, 2);

  if v_kg_cal1 > 0 then
    select *
    into v_summary
    from public.get_sellable_cal1_stock_summary(v_tenant_id);

    v_available := round(coalesce(v_summary.disponibil_cal1_kg, 0)::numeric, 2);

    if v_available - v_kg_cal1 < 0 then
      raise exception 'cannot_delete_harvested_stock'
        using hint = 'Stocul ar deveni negativ. Există comenzi care depind de această recoltare.';
    end if;
  end if;

  -- NU se mai șterg rândurile din miscari_stoc: arhiva rămâne înghețată.
  delete from public.recoltari
  where id = p_recoltare_id
    and tenant_id = v_tenant_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Documentare stock_deducted (nu se modifică comportamentul)
-- ---------------------------------------------------------------------------
comment on column public.comenzi.stock_deducted is
  'Folosit DOAR de modulul Asociație (mark_association_order_delivered_atomic) ca gardă de idempotență. Fluxul fermierului (pipeline-ul derivat din 20260626000005) NU îl citește și NU îl scrie.';

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on function public.create_ajustare_stoc(text, numeric, text, date) from public;
revoke all on function public.create_ajustare_stoc(text, numeric, text, date) from anon;
grant execute on function public.create_ajustare_stoc(text, numeric, text, date) to authenticated, service_role;

revoke all on function public.resolve_zmeura_produs_id(uuid) from public;
revoke all on function public.resolve_zmeura_produs_id(uuid) from anon;
grant execute on function public.resolve_zmeura_produs_id(uuid) to authenticated, service_role;

revoke all on function public.sync_shop_order_bridge_status(uuid, text) from public;
revoke all on function public.sync_shop_order_bridge_status(uuid, text) from anon;
grant execute on function public.sync_shop_order_bridge_status(uuid, text) to authenticated, service_role;

revoke all on function public.resync_shop_order_bridge_qty(uuid) from public;
revoke all on function public.resync_shop_order_bridge_qty(uuid) from anon;
grant execute on function public.resync_shop_order_bridge_qty(uuid) to authenticated, service_role;

revoke all on function public.promote_shop_order_to_comanda(uuid) from public;
revoke all on function public.promote_shop_order_to_comanda(uuid) from anon;
grant execute on function public.promote_shop_order_to_comanda(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
