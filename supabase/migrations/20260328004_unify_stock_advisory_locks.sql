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

  if v_tarif is null or v_tarif <= 0 then
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

  perform public.sync_recoltare_stock_movements(
    v_recoltare.id,
    v_tenant_id,
    p_parcela_id,
    p_data,
    v_kg_cal1,
    v_kg_cal2,
    v_recoltare.observatii
  );

  return v_recoltare;
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
  v_today date := current_date;
  v_remaining_date date;
  v_bucket record;
begin
  if v_user_id is null then
    raise exception 'Neautorizat';
  end if;

  select public.current_tenant_id()
  into v_tenant_id;

  if v_tenant_id is null then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
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
    gen_random_uuid()::text,
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
      status,
      observatii,
      parent_comanda_id
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
      case when v_remaining_date > v_today then 'programata' else 'confirmata' end,
      concat_ws(
        ' | ',
        nullif(btrim(coalesce(v_order.observatii, '')), ''),
        format('Rest din comanda %s', v_order.id)
      ),
      v_order.id
    )
    returning *
    into v_remaining_order;
  end if;

  return jsonb_build_object(
    'delivered_order', to_jsonb(v_delivered_order),
    'vanzare', to_jsonb(v_sale),
    'remaining_order', to_jsonb(v_remaining_order),
    'deducted_stock_kg', v_deducted_stock
  );
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

  if v_order.linked_vanzare_id is not null then
    perform public.delete_vanzare_with_stock(v_order.linked_vanzare_id);
  end if;

  delete from public.comenzi
  where id = v_order.id
    and tenant_id = v_tenant_id;
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

create or replace function public.update_vanzare_with_stock(
  p_vanzare_id uuid,
  p_data date default null,
  p_client_id uuid default null,
  p_cantitate_kg numeric default null,
  p_pret_lei_kg numeric default null,
  p_status_plata text default null,
  p_observatii_ladite text default null,
  p_tenant_id uuid default null
)
returns public.vanzari
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_vanzare public.vanzari;
  v_existing_move public.miscari_stoc;
  v_existing_move_count integer := 0;
  v_old_qty numeric := 0;
  v_new_qty numeric := 0;
  v_new_price numeric := 0;
  v_delta numeric := 0;
  v_available_stock numeric := 0;
  v_move_quality text;
  v_status_plata text;
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

  perform pg_advisory_xact_lock(hashtext('stock-mutation'), hashtext(v_tenant_id::text));

  select *
  into v_vanzare
  from public.vanzari
  where id = p_vanzare_id
    and tenant_id = v_tenant_id
  for update;

  if not found then
    raise exception 'Vanzarea este invalida pentru tenantul curent.';
  end if;

  select count(*)::int
  into v_existing_move_count
  from public.miscari_stoc ms
  where ms.tenant_id = v_tenant_id
    and ms.referinta_id = p_vanzare_id
    and (
      ms.tip = 'vanzare'
      or ms.tip_miscare = 'vanzare'
    );

  if v_existing_move_count = 0 then
    raise exception 'Miscarea de stoc asociata vanzarii lipseste.';
  end if;

  select *
  into v_existing_move
  from public.miscari_stoc ms
  where ms.tenant_id = v_tenant_id
    and ms.referinta_id = p_vanzare_id
    and (
      ms.tip = 'vanzare'
      or ms.tip_miscare = 'vanzare'
    )
  order by ms.created_at asc
  limit 1
  for update;

  v_old_qty := round(coalesce(v_vanzare.cantitate_kg, 0)::numeric, 2);
  v_new_qty := round(greatest(coalesce(p_cantitate_kg, v_vanzare.cantitate_kg, 0), 0)::numeric, 2);
  v_new_price := round(greatest(coalesce(p_pret_lei_kg, v_vanzare.pret_lei_kg, 0), 0)::numeric, 2);
  v_delta := round((v_new_qty - v_old_qty)::numeric, 2);

  if v_new_qty <= 0 then
    raise exception 'Cantitatea trebuie sa fie mai mare decat 0.';
  end if;

  if v_new_price <= 0 then
    raise exception 'Pretul trebuie sa fie mai mare decat 0.';
  end if;

  if v_existing_move_count > 1 and v_delta <> 0 then
    raise exception 'Cantitatea nu poate fi editata pentru vanzarile provenite din livrari cu mai multe alocari de stoc.';
  end if;

  if v_delta > 0 then
    if v_existing_move.locatie_id is not null
      and v_existing_move.produs is not null
      and v_existing_move.calitate is not null
      and v_existing_move.depozit is not null then
      select coalesce(
        sum(
          case
            when ms.tip_miscare in ('vanzare', 'consum', 'oferit_gratuit', 'pierdere') then -coalesce(ms.cantitate_kg, 0)
            else coalesce(ms.cantitate_kg, 0)
          end
        ),
        0
      )
      into v_available_stock
      from public.miscari_stoc ms
      where ms.tenant_id = v_tenant_id
        and ms.locatie_id = v_existing_move.locatie_id
        and ms.produs = v_existing_move.produs
        and ms.calitate = v_existing_move.calitate
        and ms.depozit = v_existing_move.depozit
        and ms.tip_miscare is not null
        and ms.cantitate_kg is not null;
    else
      select coalesce(
        sum(
          case
            when ms.tip_miscare in ('vanzare', 'consum', 'oferit_gratuit', 'pierdere') then -coalesce(ms.cantitate_kg, 0)
            else coalesce(ms.cantitate_kg, 0)
          end
        ),
        0
      )
      into v_available_stock
      from public.miscari_stoc ms
      where ms.tenant_id = v_tenant_id
        and ms.tip_miscare is not null
        and ms.cantitate_kg is not null;
    end if;

    if round(v_available_stock::numeric, 2) < v_delta then
      raise exception 'Stoc insuficient pentru a mari vanzarea.';
    end if;
  end if;

  v_status_plata := coalesce(
    nullif(btrim(coalesce(p_status_plata, '')), ''),
    nullif(btrim(coalesce(v_vanzare.status_plata, '')), ''),
    'platit'
  );

  update public.vanzari
  set data = coalesce(p_data, v_vanzare.data),
      client_id = coalesce(p_client_id, v_vanzare.client_id),
      cantitate_kg = v_new_qty,
      pret_lei_kg = v_new_price,
      status_plata = v_status_plata,
      observatii_ladite = coalesce(
        nullif(btrim(coalesce(p_observatii_ladite, '')), ''),
        v_vanzare.observatii_ladite
      ),
      updated_at = now(),
      updated_by = v_user_id
  where id = p_vanzare_id
    and tenant_id = v_tenant_id
  returning *
  into v_vanzare;

  if v_existing_move_count = 1 then
    v_move_quality := coalesce(
      v_existing_move.calitate,
      case
        when coalesce(v_existing_move.cantitate_cal2, 0) <> 0 then 'cal2'
        else 'cal1'
      end
    );

    update public.miscari_stoc
    set tenant_id = v_tenant_id,
        locatie_id = v_existing_move.locatie_id,
        produs = v_existing_move.produs,
        calitate = v_existing_move.calitate,
        depozit = v_existing_move.depozit,
        tip = 'vanzare',
        tip_miscare = 'vanzare',
        cantitate_kg = v_new_qty,
        cantitate_cal1 = case when v_move_quality = 'cal2' then 0 else -v_new_qty end,
        cantitate_cal2 = case when v_move_quality = 'cal2' then -v_new_qty else 0 end,
        referinta_id = v_vanzare.id,
        data = coalesce(p_data, v_existing_move.data, v_vanzare.data),
        observatii = coalesce(v_existing_move.observatii, 'Scadere stoc la vanzare'),
        descriere = coalesce(v_existing_move.descriere, 'Scadere stoc la vanzare')
    where id = v_existing_move.id;
  else
    update public.miscari_stoc
    set tenant_id = v_tenant_id,
        tip = 'vanzare',
        tip_miscare = 'vanzare',
        referinta_id = v_vanzare.id,
        data = coalesce(p_data, data),
        observatii = coalesce(observatii, 'Consum stoc prin livrare comanda'),
        descriere = coalesce(descriere, 'Consum stoc prin livrare comanda')
    where tenant_id = v_tenant_id
      and referinta_id = p_vanzare_id
      and (
        tip = 'vanzare'
        or tip_miscare = 'vanzare'
      );
  end if;

  return v_vanzare;
end;
$$;

notify pgrst, 'reload schema';
