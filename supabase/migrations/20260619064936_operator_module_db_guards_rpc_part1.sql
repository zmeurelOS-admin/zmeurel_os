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
  v_total_stock_after numeric := 0;
  v_total_stock_before numeric := 0;
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

  perform 1
  from (
    with affected_buckets as (
      select distinct ms.locatie_id, ms.produs, ms.calitate, ms.depozit
      from public.miscari_stoc ms
      where ms.tenant_id = v_tenant_id
        and ms.referinta_id = p_recoltare_id
        and (ms.tip = 'recoltare' or ms.tip_miscare = 'recoltare')
        and ms.locatie_id is not null
        and ms.produs is not null
        and ms.calitate is not null
        and ms.depozit is not null
    ),
    current_rows as (
      select
        ms.locatie_id,
        ms.produs,
        ms.calitate,
        ms.depozit,
        case
          when ms.tip_miscare in ('vanzare', 'consum', 'oferit_gratuit', 'pierdere') then -coalesce(ms.cantitate_kg, 0)
          else coalesce(ms.cantitate_kg, 0)
        end as signed_qty
      from public.miscari_stoc ms
      where ms.tenant_id = v_tenant_id
    ),
    simulated_rows as (
      select
        ms.locatie_id,
        ms.produs,
        ms.calitate,
        ms.depozit,
        case
          when ms.tip_miscare in ('vanzare', 'consum', 'oferit_gratuit', 'pierdere') then -coalesce(ms.cantitate_kg, 0)
          else coalesce(ms.cantitate_kg, 0)
        end as signed_qty
      from public.miscari_stoc ms
      where ms.tenant_id = v_tenant_id
        and not (
          ms.referinta_id = p_recoltare_id
          and (ms.tip = 'recoltare' or ms.tip_miscare = 'recoltare')
        )
    )
    select 1
    from affected_buckets bucket
    left join current_rows current_state
      on current_state.locatie_id = bucket.locatie_id
     and current_state.produs = bucket.produs
     and current_state.calitate = bucket.calitate
     and current_state.depozit = bucket.depozit
    left join simulated_rows row_state
      on row_state.locatie_id = bucket.locatie_id
     and row_state.produs = bucket.produs
     and row_state.calitate = bucket.calitate
     and row_state.depozit = bucket.depozit
    group by bucket.locatie_id, bucket.produs, bucket.calitate, bucket.depozit
    having round(coalesce(sum(row_state.signed_qty), 0)::numeric, 2) < 0
       and round(coalesce(sum(row_state.signed_qty), 0)::numeric, 2) < round(coalesce(sum(current_state.signed_qty), 0)::numeric, 2)
  ) as negative_bucket
  limit 1;

  if found then
    raise exception 'cannot_delete_harvested_stock'
      using hint = 'Stocul ar deveni negativ. Există vânzări care depind de această recoltare.';
  end if;

  select round(coalesce(sum(current_total.signed_qty), 0)::numeric, 2)
  into v_total_stock_before
  from (
    select
      case
        when ms.tip_miscare in ('vanzare', 'consum', 'oferit_gratuit', 'pierdere') then -coalesce(ms.cantitate_kg, 0)
        else coalesce(ms.cantitate_kg, 0)
      end as signed_qty
    from public.miscari_stoc ms
    where ms.tenant_id = v_tenant_id
  ) as current_total;

  select round(coalesce(sum(simulated_total.signed_qty), 0)::numeric, 2)
  into v_total_stock_after
  from (
    select
      case
        when ms.tip_miscare in ('vanzare', 'consum', 'oferit_gratuit', 'pierdere') then -coalesce(ms.cantitate_kg, 0)
        else coalesce(ms.cantitate_kg, 0)
      end as signed_qty
    from public.miscari_stoc ms
    where ms.tenant_id = v_tenant_id
      and not (
        ms.referinta_id = p_recoltare_id
        and (ms.tip = 'recoltare' or ms.tip_miscare = 'recoltare')
      )
  ) as simulated_total;

  if v_total_stock_after < 0 and v_total_stock_after < v_total_stock_before then
    raise exception 'cannot_delete_harvested_stock'
      using hint = 'Stocul ar deveni negativ. Există vânzări care depind de această recoltare.';
  end if;

  delete from public.miscari_stoc
  where tenant_id = v_tenant_id
    and referinta_id = p_recoltare_id
    and (tip = 'recoltare' or tip_miscare = 'recoltare');

  delete from public.recoltari
  where id = p_recoltare_id
    and tenant_id = v_tenant_id;
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

  if v_order.linked_vanzare_id is not null then
    perform public.delete_vanzare_with_stock(v_order.linked_vanzare_id);
  end if;

  delete from public.comenzi
  where id = v_order.id
    and tenant_id = v_tenant_id;
end;
$$;


create or replace function public.upsert_with_idempotency(table_name text, payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  assignments text;
  lww_condition text := '(coalesce(excluded.updated_at, now()) >= coalesce(t.updated_at, ''epoch''::timestamptz))';
  conflict_condition text := '(t.updated_at is not null and excluded.updated_at is not null and t.updated_at <> excluded.updated_at and abs(extract(epoch from (excluded.updated_at - t.updated_at))) < 5)';
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_payload_tenant uuid;
  v_payload jsonb := coalesce(payload, '{}'::jsonb);
begin
  if v_user_id is null then
    raise exception 'Neautorizat';
  end if;

  if table_name not in ('recoltari', 'vanzari', 'activitati_agricole', 'cheltuieli_diverse') then
    raise exception 'Unsupported table: %', table_name;
  end if;

  select public.current_tenant_id()
  into v_tenant_id;

  if v_tenant_id is null then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  if table_name = 'recoltari'
    and not (public.is_tenant_owner(v_tenant_id) or public.operator_can_write('recoltari')) then
    raise exception 'forbidden_read_only';
  end if;

  if table_name = 'activitati_agricole'
    and not (public.is_tenant_owner(v_tenant_id) or public.operator_can_write('activitati')) then
    raise exception 'forbidden_read_only';
  end if;

  if table_name in ('vanzari', 'cheltuieli_diverse')
    and not public.is_tenant_owner(v_tenant_id) then
    raise exception 'forbidden_owner_only';
  end if;

  begin
    if nullif(btrim(coalesce(v_payload ->> 'tenant_id', '')), '') is not null then
      v_payload_tenant := (v_payload ->> 'tenant_id')::uuid;
    end if;
  exception
    when invalid_text_representation then
      raise exception 'Tenant invalid pentru utilizatorul curent.';
  end;

  if v_payload_tenant is not null and v_payload_tenant <> v_tenant_id then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  v_payload := jsonb_set(v_payload, '{tenant_id}', to_jsonb(v_tenant_id), true);

  select string_agg(
    case
      when c.column_name = 'conflict_flag' then format(
        '%1$I = case when %2$s then true when %3$s then false else t.%1$I end',
        c.column_name,
        conflict_condition,
        lww_condition
      )
      else format(
        '%1$I = case when %2$s then excluded.%1$I else t.%1$I end',
        c.column_name,
        lww_condition
      )
    end,
    ', '
  )
  into assignments
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = table_name
    and c.column_name not in ('id', 'created_at', 'created_by', 'client_sync_id');

  execute format(
    'with incoming as (
      select * from jsonb_populate_record(null::public.%1$I, $1)
    ),
    upserted as (
      insert into public.%1$I as t
      select * from incoming
      on conflict (client_sync_id)
      do update set %2$s
      returning t.*
    )
    select to_jsonb(upserted) from upserted',
    table_name,
    assignments
  )
  into result
  using v_payload;

  return result;
end;
$$;

