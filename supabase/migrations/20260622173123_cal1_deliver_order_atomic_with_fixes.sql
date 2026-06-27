
create or replace function public.deliver_order_atomic(
  p_order_id uuid, p_delivered_qty numeric, p_payment_status text default 'Restanta', p_remaining_delivery_date date default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid(); v_tenant_id uuid; v_order public.comenzi; v_sale public.vanzari;
  v_delivered_order public.comenzi; v_remaining_order public.comenzi; v_sale_observatii text;
  v_delivered_qty numeric := round(greatest(coalesce(p_delivered_qty, 0), 0)::numeric, 2);
  v_current_qty numeric; v_remaining_qty numeric; v_total_available numeric; v_remaining_to_allocate numeric;
  v_take numeric; v_deducted_stock numeric := 0; v_today date := public.bucharest_today(); v_remaining_date date; v_bucket record;
  v_active_reservation_count integer := 0; v_active_reserved_kg numeric := 0;
begin
  if v_user_id is null then raise exception 'Neautorizat'; end if;
  select public.current_tenant_id() into v_tenant_id;
  if v_tenant_id is null then raise exception 'Tenant invalid pentru utilizatorul curent.'; end if;
  if not (public.is_tenant_owner(v_tenant_id) or public.operator_can_write('livrari')) then raise exception 'forbidden_read_only'; end if;
  perform pg_advisory_xact_lock(hashtext('stock-mutation'), hashtext(v_tenant_id::text));
  select * into v_order from public.comenzi where id = p_order_id and tenant_id = v_tenant_id for update;
  if not found then raise exception 'Comanda este invalida pentru tenantul curent.'; end if;
  v_current_qty := round(coalesce(v_order.cantitate_kg, 0)::numeric, 2);
  if v_delivered_qty <= 0 then raise exception 'Cantitatea livrata trebuie sa fie mai mare decat 0.'; end if;
  if v_delivered_qty > v_current_qty then raise exception 'Cantitatea livrata nu poate depasi cantitatea comandata.'; end if;
  if v_order.status = 'anulata' then raise exception 'Comanda anulata nu poate fi livrata.'; end if;
  if v_order.status = 'livrata' or v_order.linked_vanzare_id is not null then raise exception 'Comanda este deja livrata.'; end if;

  select count(*), round(coalesce(sum(sr.cantitate_kg), 0)::numeric, 2) into v_active_reservation_count, v_active_reserved_kg
  from public.stock_reservations sr where sr.tenant_id = v_tenant_id and sr.comanda_id = v_order.id and sr.status = 'active';

  if v_active_reservation_count > 0 and v_active_reserved_kg < v_delivered_qty then
    raise exception 'Rezervarea de stoc pentru comandă este incompletă.';
  end if;

  if v_active_reservation_count = 0 then
    select coalesce(sum(stock_bucket.available_kg), 0) into v_total_available
    from (
      select round(sum(case when ms.tip_miscare in ('vanzare', 'consum', 'oferit_gratuit', 'pierdere') then -coalesce(ms.cantitate_kg, 0) else coalesce(ms.cantitate_kg, 0) end)::numeric, 2) as available_kg
      from public.miscari_stoc ms
      where ms.tenant_id = v_tenant_id and ms.locatie_id is not null and ms.produs is not null and ms.calitate is not null
        and ms.depozit is not null and ms.tip_miscare is not null and ms.cantitate_kg is not null
      group by ms.locatie_id, ms.produs, ms.calitate, ms.depozit
      having sum(case when ms.tip_miscare in ('vanzare', 'consum', 'oferit_gratuit', 'pierdere') then -coalesce(ms.cantitate_kg, 0) else coalesce(ms.cantitate_kg, 0) end) > 0
    ) as stock_bucket;
    if v_total_available < v_delivered_qty then raise exception 'Stoc insuficient pentru livrare.'; end if;
  end if;

  v_sale_observatii := concat_ws(' | ', nullif(btrim(coalesce(v_order.observatii, '')), ''), format('Livrare comanda %s', v_order.id));

  insert into public.vanzari (tenant_id, client_sync_id, id_vanzare, data, client_id, comanda_id, cantitate_kg, pret_lei_kg, status_plata, observatii_ladite, sync_status, created_by, updated_by)
  values (v_tenant_id, gen_random_uuid(), public.generate_business_id('V'), v_today, v_order.client_id, v_order.id, v_delivered_qty,
    round(coalesce(v_order.pret_per_kg, 0)::numeric, 2), coalesce(nullif(btrim(coalesce(p_payment_status, '')), ''), 'Restanta'),
    nullif(btrim(v_sale_observatii), ''), 'synced', v_user_id, v_user_id)
  returning * into v_sale;

  if v_active_reservation_count > 0 then
    v_deducted_stock := public.consume_active_stock_reservations_for_comanda(v_tenant_id, v_order.id, v_sale.id, v_delivered_qty, v_today, 'Consum stoc prin livrare comanda');
    if v_deducted_stock < v_delivered_qty then
      raise exception 'Consum de stoc incomplet din rezervări: % din % kg',
        trim(to_char(v_deducted_stock, 'FM999999990.00')),
        trim(to_char(v_delivered_qty, 'FM999999990.00'));
    end if;
  else
    v_remaining_to_allocate := v_delivered_qty;
    for v_bucket in
      select ms.locatie_id, ms.produs, ms.calitate, ms.depozit,
        round(sum(case when ms.tip_miscare in ('vanzare', 'consum', 'oferit_gratuit', 'pierdere') then -coalesce(ms.cantitate_kg, 0) else coalesce(ms.cantitate_kg, 0) end)::numeric, 2) as available_kg
      from public.miscari_stoc ms
      where ms.tenant_id = v_tenant_id and ms.locatie_id is not null and ms.produs is not null and ms.calitate is not null
        and ms.depozit is not null and ms.tip_miscare is not null and ms.cantitate_kg is not null
      group by ms.locatie_id, ms.produs, ms.calitate, ms.depozit
      having sum(case when ms.tip_miscare in ('vanzare', 'consum', 'oferit_gratuit', 'pierdere') then -coalesce(ms.cantitate_kg, 0) else coalesce(ms.cantitate_kg, 0) end) > 0
      order by available_kg desc
    loop
      exit when v_remaining_to_allocate <= 0;
      v_take := round(least(v_bucket.available_kg, v_remaining_to_allocate)::numeric, 2);
      if v_take <= 0 then continue; end if;
      insert into public.miscari_stoc (tenant_id, locatie_id, produs, calitate, depozit, tip_miscare, cantitate_kg, tip, cantitate_cal1, cantitate_cal2, referinta_id, data, observatii, descriere)
      values (v_tenant_id, v_bucket.locatie_id, v_bucket.produs, v_bucket.calitate, v_bucket.depozit, 'vanzare', v_take, 'vanzare',
        case when v_bucket.calitate = 'cal1' then -v_take else 0 end, case when v_bucket.calitate = 'cal2' then -v_take else 0 end,
        v_sale.id, v_today, 'Consum stoc prin livrare comanda', 'Consum stoc prin livrare comanda');
      v_deducted_stock := round((v_deducted_stock + v_take)::numeric, 2);
      v_remaining_to_allocate := round((v_remaining_to_allocate - v_take)::numeric, 2);
    end loop;
    if v_remaining_to_allocate > 0 then raise exception 'Stoc insuficient pentru livrare.'; end if;
  end if;

  update public.comenzi set status = 'livrata', linked_vanzare_id = v_sale.id,
    observatii = concat_ws(' | ', nullif(btrim(coalesce(v_order.observatii, '')), ''), format('Livrata: %s kg', trim(to_char(v_delivered_qty, 'FM999999990.00')))),
    updated_at = now()
  where id = v_order.id and tenant_id = v_tenant_id returning * into v_delivered_order;

  v_remaining_qty := round((v_current_qty - v_delivered_qty)::numeric, 2);
  if v_remaining_qty > 0 then
    v_remaining_date := coalesce(p_remaining_delivery_date, v_today + 1);
    insert into public.comenzi (tenant_id, client_id, client_nume_manual, telefon, locatie_livrare, data_comanda, data_livrare, cantitate_kg, pret_per_kg, total, order_kind, status, observatii, parent_comanda_id, data_origin)
    values (v_tenant_id, v_order.client_id, v_order.client_nume_manual, v_order.telefon, v_order.locatie_livrare, v_today, v_remaining_date,
      v_remaining_qty, round(coalesce(v_order.pret_per_kg, 0)::numeric, 2), round((v_remaining_qty * coalesce(v_order.pret_per_kg, 0))::numeric, 2),
      coalesce(v_order.order_kind, 'manual'), case when v_remaining_date > v_today then 'programata' else 'confirmata' end,
      concat_ws(' | ', nullif(btrim(coalesce(v_order.observatii, '')), ''), format('Rest din comanda %s', v_order.id)), v_order.id, v_order.data_origin)
    returning * into v_remaining_order;
    if v_active_reservation_count > 0 then
      update public.stock_reservations set status = 'released', released_at = now()
      where tenant_id = v_tenant_id and comanda_id = v_order.id and status = 'active';
    end if;
  end if;

  return jsonb_build_object('delivered_order', to_jsonb(v_delivered_order), 'vanzare', to_jsonb(v_sale), 'remaining_order', to_jsonb(v_remaining_order), 'deducted_stock_kg', v_deducted_stock);
end;
$$;
;
