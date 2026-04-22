create or replace function public.create_vanzare_with_stock(
  p_data date,
  p_client_id uuid default null,
  p_comanda_id uuid default null,
  p_cantitate_kg numeric default 0,
  p_pret_lei_kg numeric default 0,
  p_status_plata text default 'Platit',
  p_observatii_ladite text default null,
  p_client_sync_id text default null,
  p_sync_status text default 'synced',
  p_tenant_id uuid default null,
  p_calitate text default 'cal1'
)
returns public.vanzari
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_cantitate numeric := round(greatest(coalesce(p_cantitate_kg, 0), 0)::numeric, 2);
  v_pret numeric := round(greatest(coalesce(p_pret_lei_kg, 0), 0)::numeric, 2);
  v_vanzare public.vanzari;
  v_calitate text := lower(coalesce(nullif(btrim(coalesce(p_calitate, '')), ''), 'cal1'));
  v_cantitate_cal1 numeric := 0;
  v_cantitate_cal2 numeric := 0;
  v_client_sync_id_raw text := nullif(btrim(coalesce(p_client_sync_id, '')), '');
  v_client_sync_id uuid;
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

  if v_cantitate <= 0 then
    raise exception 'Cantitatea trebuie sa fie mai mare decat 0.';
  end if;

  if v_pret <= 0 then
    raise exception 'Pretul trebuie sa fie mai mare decat 0.';
  end if;

  if v_calitate not in ('cal1', 'cal2') then
    raise exception 'Calitatea trebuie sa fie cal1 sau cal2.';
  end if;

  if v_client_sync_id_raw is not null
    and v_client_sync_id_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then
    v_client_sync_id := v_client_sync_id_raw::uuid;
  else
    v_client_sync_id := gen_random_uuid();
  end if;

  if v_calitate = 'cal1' then
    v_cantitate_cal1 := -v_cantitate;
  else
    v_cantitate_cal2 := -v_cantitate;
  end if;

  if p_client_id is not null then
    perform 1
    from public.clienti c
    where c.id = p_client_id
      and c.tenant_id = v_tenant_id;

    if not found then
      raise exception 'Client invalid pentru tenantul curent.';
    end if;
  end if;

  if p_comanda_id is not null then
    perform 1
    from public.comenzi c
    where c.id = p_comanda_id
      and c.tenant_id = v_tenant_id;

    if not found then
      raise exception 'Comanda invalida pentru tenantul curent.';
    end if;
  end if;

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
    v_client_sync_id,
    public.generate_business_id('V'),
    p_data,
    p_client_id,
    p_comanda_id,
    v_cantitate,
    v_pret,
    coalesce(nullif(btrim(coalesce(p_status_plata, '')), ''), 'Platit'),
    nullif(btrim(coalesce(p_observatii_ladite, '')), ''),
    coalesce(nullif(btrim(coalesce(p_sync_status, '')), ''), 'synced'),
    v_user_id,
    v_user_id
  )
  returning *
  into v_vanzare;

  insert into public.miscari_stoc (
    tenant_id,
    tip,
    tip_miscare,
    cantitate_kg,
    cantitate_cal1,
    cantitate_cal2,
    referinta_id,
    data,
    descriere,
    calitate
  )
  values (
    v_tenant_id,
    'vanzare',
    'vanzare',
    v_cantitate,
    v_cantitate_cal1,
    v_cantitate_cal2,
    v_vanzare.id,
    p_data,
    'Scadere stoc la vanzare',
    v_calitate
  );

  return v_vanzare;
end;
$$;

revoke all on function public.create_vanzare_with_stock(date, uuid, uuid, numeric, numeric, text, text, text, text, uuid, text) from public;
grant execute on function public.create_vanzare_with_stock(date, uuid, uuid, numeric, numeric, text, text, text, text, uuid, text) to authenticated;
grant execute on function public.create_vanzare_with_stock(date, uuid, uuid, numeric, numeric, text, text, text, text, uuid, text) to service_role;

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
