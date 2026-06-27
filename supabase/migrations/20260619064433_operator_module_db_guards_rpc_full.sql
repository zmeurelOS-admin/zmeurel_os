create or replace function public.update_recoltare_with_stock(
  p_recoltare_id uuid, p_data date, p_parcela_id uuid, p_culegator_id uuid,
  p_kg_cal1 numeric default 0, p_kg_cal2 numeric default 0, p_observatii text default null
)
returns public.recoltari language plpgsql security definer set search_path = public as $$
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
  v_new_identity jsonb;
  v_new_produs text;
  v_total_stock_after numeric := 0;
  v_total_stock_before numeric := 0;
begin
  if v_user_id is null then raise exception 'Neautorizat'; end if;
  select public.current_tenant_id() into v_tenant_id;
  if v_tenant_id is null then raise exception 'Tenant invalid pentru utilizatorul curent.'; end if;
  if not (public.is_tenant_owner(v_tenant_id) or public.operator_can_write('recoltari')) then raise exception 'forbidden_read_only'; end if;
  perform pg_advisory_xact_lock(hashtext('stock-mutation'), hashtext(v_tenant_id::text));
  select * into v_current_recoltare from public.recoltari r where r.id = p_recoltare_id and r.tenant_id = v_tenant_id for update;
  if not found then raise exception 'Recoltarea este invalida pentru tenantul curent.'; end if;
  perform 1 from public.parcele p where p.id = p_parcela_id and p.tenant_id = v_tenant_id;
  if not found then raise exception 'Parcela este invalida pentru tenantul curent.'; end if;
  select c.tarif_lei_kg into v_tarif from public.culegatori c where c.id = p_culegator_id and c.tenant_id = v_tenant_id;
  if v_tarif is null then raise exception 'Culegatorul nu are tarif setat in profil'; end if;
  v_new_identity := public.resolve_recoltare_stock_identity(p_parcela_id, p_observatii, v_tenant_id);
  v_new_produs := coalesce(nullif(btrim(v_new_identity ->> 'produs'), ''), 'produs-necunoscut');
  perform 1 from (
    with affected_buckets as (
      select distinct bucket.locatie_id, bucket.produs, bucket.calitate, bucket.depozit
      from (
        select ms.locatie_id, ms.produs, ms.calitate, ms.depozit
        from public.miscari_stoc ms
        where ms.tenant_id = v_tenant_id and ms.referinta_id = p_recoltare_id
          and (ms.tip = 'recoltare' or ms.tip_miscare = 'recoltare')
          and ms.locatie_id is not null and ms.produs is not null and ms.calitate is not null and ms.depozit is not null
        union all select p_parcela_id, v_new_produs, 'cal1', 'fresh' where v_kg_cal1 > 0
        union all select p_parcela_id, v_new_produs, 'cal2', 'fresh' where v_kg_cal2 > 0
      ) as bucket
    ),
    current_rows as (
      select ms.locatie_id, ms.produs, ms.calitate, ms.depozit,
        case when ms.tip_miscare in ('vanzare','consum','oferit_gratuit','pierdere') then -coalesce(ms.cantitate_kg,0) else coalesce(ms.cantitate_kg,0) end as signed_qty
      from public.miscari_stoc ms where ms.tenant_id = v_tenant_id
    ),
    simulated_rows as (
      select ms.locatie_id, ms.produs, ms.calitate, ms.depozit,
        case when ms.tip_miscare in ('vanzare','consum','oferit_gratuit','pierdere') then -coalesce(ms.cantitate_kg,0) else coalesce(ms.cantitate_kg,0) end as signed_qty
      from public.miscari_stoc ms where ms.tenant_id = v_tenant_id
        and not (ms.referinta_id = p_recoltare_id and (ms.tip = 'recoltare' or ms.tip_miscare = 'recoltare'))
      union all select p_parcela_id, v_new_produs, 'cal1', 'fresh', v_kg_cal1 where v_kg_cal1 > 0
      union all select p_parcela_id, v_new_produs, 'cal2', 'fresh', v_kg_cal2 where v_kg_cal2 > 0
    )
    select 1 from affected_buckets bucket
    left join current_rows current_state on current_state.locatie_id = bucket.locatie_id and current_state.produs = bucket.produs and current_state.calitate = bucket.calitate and current_state.depozit = bucket.depozit
    left join simulated_rows row_state on row_state.locatie_id = bucket.locatie_id and row_state.produs = bucket.produs and row_state.calitate = bucket.calitate and row_state.depozit = bucket.depozit
    group by bucket.locatie_id, bucket.produs, bucket.calitate, bucket.depozit
    having round(coalesce(sum(row_state.signed_qty),0)::numeric,2) < 0
       and round(coalesce(sum(row_state.signed_qty),0)::numeric,2) < round(coalesce(sum(current_state.signed_qty),0)::numeric,2)
  ) as negative_bucket limit 1;
  if found then raise exception 'insufficient_stock_after_edit' using hint = 'Stocul ar deveni negativ după editare. Există vânzări care depind de această recoltare.'; end if;
  select round(coalesce(sum(current_total.signed_qty),0)::numeric,2) into v_total_stock_before
  from (select case when ms.tip_miscare in ('vanzare','consum','oferit_gratuit','pierdere') then -coalesce(ms.cantitate_kg,0) else coalesce(ms.cantitate_kg,0) end as signed_qty from public.miscari_stoc ms where ms.tenant_id = v_tenant_id) as current_total;
  select round(coalesce(sum(simulated_total.signed_qty),0)::numeric,2) into v_total_stock_after
  from (
    select case when ms.tip_miscare in ('vanzare','consum','oferit_gratuit','pierdere') then -coalesce(ms.cantitate_kg,0) else coalesce(ms.cantitate_kg,0) end as signed_qty
    from public.miscari_stoc ms where ms.tenant_id = v_tenant_id and not (ms.referinta_id = p_recoltare_id and (ms.tip = 'recoltare' or ms.tip_miscare = 'recoltare'))
    union all select v_kg_cal1 where v_kg_cal1 > 0
    union all select v_kg_cal2 where v_kg_cal2 > 0
  ) as simulated_total;
  if v_total_stock_after < 0 and v_total_stock_after < v_total_stock_before then raise exception 'insufficient_stock_after_edit' using hint = 'Stocul ar deveni negativ după editare. Există vânzări care depind de această recoltare.'; end if;
  v_valoare_munca := round((v_total_kg * v_tarif)::numeric, 2);
  update public.recoltari set data = p_data, parcela_id = p_parcela_id, culegator_id = p_culegator_id, kg_cal1 = v_kg_cal1, kg_cal2 = v_kg_cal2, pret_lei_pe_kg_snapshot = round(v_tarif::numeric,2), valoare_munca_lei = v_valoare_munca, observatii = nullif(btrim(coalesce(p_observatii,'')),''), updated_at = now()
  where id = p_recoltare_id and tenant_id = v_tenant_id returning * into v_recoltare;
  perform public.sync_recoltare_stock_movements(v_recoltare.id, v_tenant_id, p_parcela_id, p_data, v_kg_cal1, v_kg_cal2, v_recoltare.observatii);
  return v_recoltare;
end; $$;

create or replace function public.deliver_order_atomic(
  p_order_id uuid, p_delivered_qty numeric, p_payment_status text default 'Restanta', p_remaining_delivery_date date default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
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
  v_today date := current_date;
  v_remaining_date date;
  v_bucket record;
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
  select coalesce(sum(stock_bucket.available_kg), 0) into v_total_available
  from (
    select round(sum(case when ms.tip_miscare in ('vanzare','consum','oferit_gratuit','pierdere') then -coalesce(ms.cantitate_kg,0) else coalesce(ms.cantitate_kg,0) end)::numeric,2) as available_kg
    from public.miscari_stoc ms
    where ms.tenant_id = v_tenant_id and ms.locatie_id is not null and ms.produs is not null and ms.calitate is not null and ms.depozit is not null and ms.tip_miscare is not null and ms.cantitate_kg is not null
    group by ms.locatie_id, ms.produs, ms.calitate, ms.depozit
    having sum(case when ms.tip_miscare in ('vanzare','consum','oferit_gratuit','pierdere') then -coalesce(ms.cantitate_kg,0) else coalesce(ms.cantitate_kg,0) end) > 0
  ) as stock_bucket;
  if v_total_available < v_delivered_qty then raise exception 'Stoc insuficient pentru livrare.'; end if;
  v_sale_observatii := concat_ws(' | ', nullif(btrim(coalesce(v_order.observatii, '')), ''), format('Livrare comanda %s', v_order.id));
  insert into public.vanzari (tenant_id, client_sync_id, id_vanzare, data, client_id, comanda_id, cantitate_kg, pret_lei_kg, status_plata, observatii_ladite, sync_status, created_by, updated_by)
  values (v_tenant_id, gen_random_uuid(), public.generate_business_id('V'), v_today, v_order.client_id, v_order.id, v_delivered_qty, round(coalesce(v_order.pret_per_kg,0)::numeric,2), coalesce(nullif(btrim(coalesce(p_payment_status,'')),''),'Restanta'), nullif(btrim(v_sale_observatii),''), 'synced', v_user_id, v_user_id)
  returning * into v_sale;
  v_remaining_to_allocate := v_delivered_qty;
  for v_bucket in
    select ms.locatie_id, ms.produs, ms.calitate, ms.depozit,
      round(sum(case when ms.tip_miscare in ('vanzare','consum','oferit_gratuit','pierdere') then -coalesce(ms.cantitate_kg,0) else coalesce(ms.cantitate_kg,0) end)::numeric,2) as available_kg
    from public.miscari_stoc ms
    where ms.tenant_id = v_tenant_id and ms.locatie_id is not null and ms.produs is not null and ms.calitate is not null and ms.depozit is not null and ms.tip_miscare is not null and ms.cantitate_kg is not null
    group by ms.locatie_id, ms.produs, ms.calitate, ms.depozit
    having sum(case when ms.tip_miscare in ('vanzare','consum','oferit_gratuit','pierdere') then -coalesce(ms.cantitate_kg,0) else coalesce(ms.cantitate_kg,0) end) > 0
    order by available_kg desc
  loop
    exit when v_remaining_to_allocate <= 0;
    v_take := round(least(v_bucket.available_kg, v_remaining_to_allocate)::numeric, 2);
    if v_take <= 0 then continue; end if;
    insert into public.miscari_stoc (tenant_id, locatie_id, produs, calitate, depozit, tip_miscare, cantitate_kg, tip, cantitate_cal1, cantitate_cal2, referinta_id, data, observatii, descriere)
    values (v_tenant_id, v_bucket.locatie_id, v_bucket.produs, v_bucket.calitate, v_bucket.depozit, 'vanzare', v_take, 'vanzare', case when v_bucket.calitate = 'cal1' then -v_take else 0 end, case when v_bucket.calitate = 'cal2' then -v_take else 0 end, v_sale.id, v_today, 'Consum stoc prin livrare comanda', 'Consum stoc prin livrare comanda');
    v_deducted_stock := round((v_deducted_stock + v_take)::numeric, 2);
    v_remaining_to_allocate := round((v_remaining_to_allocate - v_take)::numeric, 2);
  end loop;
  if v_remaining_to_allocate > 0 then raise exception 'Stoc insuficient pentru livrare.'; end if;
  update public.comenzi set status = 'livrata', linked_vanzare_id = v_sale.id,
    observatii = concat_ws(' | ', nullif(btrim(coalesce(v_order.observatii,'')),''), format('Livrata: %s kg', trim(to_char(v_delivered_qty,'FM999999990.00')))), updated_at = now()
  where id = v_order.id and tenant_id = v_tenant_id returning * into v_delivered_order;
  v_remaining_qty := round((v_current_qty - v_delivered_qty)::numeric, 2);
  if v_remaining_qty > 0 then
    v_remaining_date := coalesce(p_remaining_delivery_date, v_today + 1);
    insert into public.comenzi (tenant_id, client_id, client_nume_manual, telefon, locatie_livrare, data_comanda, data_livrare, cantitate_kg, pret_per_kg, total, status, observatii, parent_comanda_id)
    values (v_tenant_id, v_order.client_id, v_order.client_nume_manual, v_order.telefon, v_order.locatie_livrare, v_today, v_remaining_date, v_remaining_qty, round(coalesce(v_order.pret_per_kg,0)::numeric,2), round((v_remaining_qty * coalesce(v_order.pret_per_kg,0))::numeric,2), case when v_remaining_date > v_today then 'programata' else 'confirmata' end, concat_ws(' | ', nullif(btrim(coalesce(v_order.observatii,'')),''), format('Rest din comanda %s', v_order.id)), v_order.id)
    returning * into v_remaining_order;
  end if;
  return jsonb_build_object('delivered_order', to_jsonb(v_delivered_order), 'vanzare', to_jsonb(v_sale), 'remaining_order', to_jsonb(v_remaining_order), 'deducted_stock_kg', v_deducted_stock);
end; $$;

create or replace function public.reopen_comanda_atomic(p_comanda_id uuid, p_tenant_id uuid default null)
returns public.comenzi language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_current_tenant_id uuid;
  v_tenant_id uuid;
  v_order public.comenzi;
  v_reopened public.comenzi;
  v_reopen_status public.comanda_status;
  v_blocking_children integer := 0;
begin
  if v_user_id is null then raise exception 'Neautorizat'; end if;
  select public.current_tenant_id() into v_current_tenant_id;
  if v_current_tenant_id is null then raise exception 'Tenant invalid pentru utilizatorul curent.'; end if;
  if p_tenant_id is not null and p_tenant_id <> v_current_tenant_id then raise exception 'Tenant invalid pentru utilizatorul curent.'; end if;
  v_tenant_id := v_current_tenant_id;
  if not (public.is_tenant_owner(v_tenant_id) or public.operator_can_write('comenzi')) then raise exception 'forbidden_read_only'; end if;
  perform pg_advisory_xact_lock(hashtext('stock-mutation'), hashtext(v_tenant_id::text));
  select * into v_order from public.comenzi where id = p_comanda_id and tenant_id = v_tenant_id for update;
  if not found then raise exception 'Comanda este invalida pentru tenantul curent.'; end if;
  if v_order.status <> 'livrata' then raise exception 'Doar comenzile livrate pot fi redeschise.'; end if;
  select count(*) into v_blocking_children from public.comenzi child_order
  where child_order.tenant_id = v_tenant_id and child_order.parent_comanda_id = v_order.id and (child_order.linked_vanzare_id is not null or child_order.status = 'livrata');
  if v_blocking_children > 0 then raise exception 'Comanda are livrari ulterioare si nu poate fi redeschisa.'; end if;
  if v_order.linked_vanzare_id is not null then perform public.delete_vanzare_with_stock(v_order.linked_vanzare_id); end if;
  delete from public.comenzi child_order where child_order.tenant_id = v_tenant_id and child_order.parent_comanda_id = v_order.id and child_order.linked_vanzare_id is null;
  v_reopen_status := case when v_order.data_livrare is not null and v_order.data_livrare > current_date then 'programata'::public.comanda_status else 'confirmata'::public.comanda_status end;
  update public.comenzi set status = v_reopen_status, linked_vanzare_id = null, updated_at = now(), observatii = concat_ws(' | ', nullif(btrim(coalesce(v_order.observatii,'')),''), 'Comanda redeschisa')
  where id = v_order.id and tenant_id = v_tenant_id returning * into v_reopened;
  return v_reopened;
end; $$;

revoke all on function public.update_recoltare_with_stock(uuid, date, uuid, uuid, numeric, numeric, text) from public;
revoke all on function public.deliver_order_atomic(uuid, numeric, text, date) from public;
revoke all on function public.reopen_comanda_atomic(uuid, uuid) from public;
grant execute on function public.update_recoltare_with_stock(uuid, date, uuid, uuid, numeric, numeric, text) to authenticated, service_role;
grant execute on function public.deliver_order_atomic(uuid, numeric, text, date) to authenticated, service_role;
grant execute on function public.reopen_comanda_atomic(uuid, uuid) to authenticated, service_role;;
