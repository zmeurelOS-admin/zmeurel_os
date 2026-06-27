
create or replace function public.reserve_sellable_cal1_stock(
  p_tenant_id uuid, p_source_type text, p_comanda_id uuid default null,
  p_shop_order_id uuid default null, p_required_kg numeric default 0, p_metadata jsonb default '{}'::jsonb
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_required_kg numeric := round(greatest(coalesce(p_required_kg, 0), 0)::numeric, 2);
  v_remaining_kg numeric := v_required_kg;
  v_take numeric; v_summary record; v_bucket record;
begin
  if p_tenant_id is null then raise exception 'Tenant invalid pentru utilizatorul curent.'; end if;
  if p_source_type not in ('comanda', 'shop_order') then raise exception 'Tip rezervare invalid.'; end if;
  if v_required_kg <= 0 then raise exception 'Cantitatea rezervată trebuie să fie mai mare decât 0.'; end if;

  select * into v_summary from public.get_sellable_cal1_stock_summary(p_tenant_id);

  if coalesce(v_summary.disponibil_cal1_kg, 0) < v_required_kg then
    raise exception 'Stoc insuficient: ai doar % kg cal1 disponibili, comanda cere % kg',
      trim(to_char(coalesce(v_summary.disponibil_cal1_kg, 0), 'FM999999990.00')),
      trim(to_char(v_required_kg, 'FM999999990.00'));
  end if;

  for v_bucket in select * from public.list_sellable_cal1_buckets_for_reservation(p_tenant_id) loop
    exit when v_remaining_kg <= 0;
    v_take := round(least(coalesce(v_bucket.available_kg, 0), v_remaining_kg)::numeric, 2);
    if v_take <= 0 then continue; end if;
    insert into public.stock_reservations (tenant_id, source_type, comanda_id, shop_order_id, locatie_id, produs, depozit, calitate, cantitate_kg, status, metadata)
    values (p_tenant_id, p_source_type, p_comanda_id, p_shop_order_id, v_bucket.locatie_id,
      coalesce(nullif(btrim(v_bucket.produs), ''), 'zmeura'), coalesce(nullif(btrim(v_bucket.depozit), ''), 'fresh'),
      'cal1', v_take, 'active', coalesce(p_metadata, '{}'::jsonb));
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
  p_tenant_id uuid, p_comanda_id uuid, p_vanzare_id uuid, p_delivered_qty numeric,
  p_delivery_date date, p_delivery_note text default 'Consum stoc prin livrare comanda'
)
returns numeric language plpgsql security definer set search_path = public as $$
declare
  v_reservation record;
  v_remaining numeric := round(greatest(coalesce(p_delivered_qty, 0), 0)::numeric, 2);
  v_take numeric := 0; v_consumed numeric := 0;
begin
  if v_remaining <= 0 then return 0; end if;
  for v_reservation in
    select * from public.stock_reservations sr
    where sr.tenant_id = p_tenant_id and sr.comanda_id = p_comanda_id and sr.status = 'active'
    order by sr.reserved_at asc, sr.id asc for update
  loop
    exit when v_remaining <= 0;
    v_take := round(least(coalesce(v_reservation.cantitate_kg, 0), v_remaining)::numeric, 2);
    if v_take <= 0 then continue; end if;
    insert into public.miscari_stoc (tenant_id, locatie_id, produs, calitate, depozit, tip_miscare, cantitate_kg, tip, cantitate_cal1, cantitate_cal2, referinta_id, data, observatii, descriere)
    values (p_tenant_id, v_reservation.locatie_id, v_reservation.produs, 'cal1', v_reservation.depozit, 'vanzare', v_take, 'vanzare', -v_take, 0, p_vanzare_id, p_delivery_date, p_delivery_note, p_delivery_note);
    if round(coalesce(v_reservation.cantitate_kg, 0)::numeric, 2) = v_take then
      update public.stock_reservations set status = 'consumed', consumed_at = now(), linked_vanzare_id = p_vanzare_id where id = v_reservation.id;
    else
      update public.stock_reservations set cantitate_kg = round((coalesce(v_reservation.cantitate_kg, 0) - v_take)::numeric, 2) where id = v_reservation.id;
      insert into public.stock_reservations (tenant_id, source_type, comanda_id, shop_order_id, locatie_id, produs, depozit, calitate, cantitate_kg, status, reserved_at, consumed_at, linked_vanzare_id, metadata)
      values (v_reservation.tenant_id, v_reservation.source_type, v_reservation.comanda_id, v_reservation.shop_order_id, v_reservation.locatie_id, v_reservation.produs, v_reservation.depozit, v_reservation.calitate, v_take, 'consumed', v_reservation.reserved_at, now(), p_vanzare_id, coalesce(v_reservation.metadata, '{}'::jsonb));
    end if;
    v_consumed := round((v_consumed + v_take)::numeric, 2);
    v_remaining := round((v_remaining - v_take)::numeric, 2);
  end loop;
  return v_consumed;
end;
$$;

create or replace function public.sync_recoltare_stock_movements(
  p_recoltare_id uuid, p_tenant_id uuid, p_parcela_id uuid, p_data date,
  p_kg_cal1 numeric default 0, p_kg_cal2 numeric default 0, p_observatii text default null
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_identity jsonb; v_produs text;
  v_kg_cal1 numeric := round(greatest(coalesce(p_kg_cal1, 0), 0)::numeric, 2);
begin
  delete from public.miscari_stoc where tenant_id = p_tenant_id and referinta_id = p_recoltare_id and (tip = 'recoltare' or tip_miscare = 'recoltare');
  if p_parcela_id is null then return; end if;
  v_identity := public.resolve_recoltare_stock_identity(p_parcela_id, p_observatii, p_tenant_id);
  v_produs := coalesce(nullif(btrim(v_identity ->> 'produs'), ''), 'produs-necunoscut');
  if v_kg_cal1 > 0 then
    insert into public.miscari_stoc (tenant_id, locatie_id, produs, calitate, depozit, tip_miscare, cantitate_kg, tip, cantitate_cal1, cantitate_cal2, referinta_id, data)
    values (p_tenant_id, p_parcela_id, v_produs, 'cal1', 'fresh', 'recoltare', v_kg_cal1, 'recoltare', v_kg_cal1, 0, p_recoltare_id, p_data);
  end if;
end;
$$;
;
