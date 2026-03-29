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
  v_new_identity jsonb;
  v_new_produs text;
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

  if v_tarif is null or v_tarif <= 0 then
    raise exception 'Culegatorul nu are tarif setat in profil';
  end if;

  v_new_identity := public.resolve_recoltare_stock_identity(p_parcela_id, p_observatii, v_tenant_id);
  v_new_produs := coalesce(nullif(btrim(v_new_identity ->> 'produs'), ''), 'produs-necunoscut');

  perform 1
  from (
    with affected_buckets as (
      select distinct bucket.locatie_id, bucket.produs, bucket.calitate, bucket.depozit
      from (
        select
          ms.locatie_id,
          ms.produs,
          ms.calitate,
          ms.depozit
        from public.miscari_stoc ms
        where ms.tenant_id = v_tenant_id
          and ms.referinta_id = p_recoltare_id
          and (
            ms.tip = 'recoltare'
            or ms.tip_miscare = 'recoltare'
          )
          and ms.locatie_id is not null
          and ms.produs is not null
          and ms.calitate is not null
          and ms.depozit is not null
        union all
        select p_parcela_id, v_new_produs, 'cal1', 'fresh'
        where v_kg_cal1 > 0
        union all
        select p_parcela_id, v_new_produs, 'cal2', 'fresh'
        where v_kg_cal2 > 0
      ) as bucket
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
          and (
            ms.tip = 'recoltare'
            or ms.tip_miscare = 'recoltare'
          )
        )
      union all
      select p_parcela_id, v_new_produs, 'cal1', 'fresh', v_kg_cal1
      where v_kg_cal1 > 0
      union all
      select p_parcela_id, v_new_produs, 'cal2', 'fresh', v_kg_cal2
      where v_kg_cal2 > 0
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
    raise exception 'insufficient_stock_after_edit'
      using hint = 'Stocul ar deveni negativ după editare. Există vânzări care depind de această recoltare.';
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
        and (
          ms.tip = 'recoltare'
          or ms.tip_miscare = 'recoltare'
        )
      )
    union all
    select v_kg_cal1
    where v_kg_cal1 > 0
    union all
    select v_kg_cal2
    where v_kg_cal2 > 0
  ) as simulated_total;

  if v_total_stock_after < 0 and v_total_stock_after < v_total_stock_before then
    raise exception 'insufficient_stock_after_edit'
      using hint = 'Stocul ar deveni negativ după editare. Există vânzări care depind de această recoltare.';
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
      select distinct
        ms.locatie_id,
        ms.produs,
        ms.calitate,
        ms.depozit
      from public.miscari_stoc ms
      where ms.tenant_id = v_tenant_id
        and ms.referinta_id = p_recoltare_id
        and (
          ms.tip = 'recoltare'
          or ms.tip_miscare = 'recoltare'
        )
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
          and (
            ms.tip = 'recoltare'
            or ms.tip_miscare = 'recoltare'
          )
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
        and (
          ms.tip = 'recoltare'
          or ms.tip_miscare = 'recoltare'
        )
      )
  ) as simulated_total;

  if v_total_stock_after < 0 and v_total_stock_after < v_total_stock_before then
    raise exception 'cannot_delete_harvested_stock'
      using hint = 'Stocul ar deveni negativ. Există vânzări care depind de această recoltare.';
  end if;

  delete from public.miscari_stoc
  where tenant_id = v_tenant_id
    and referinta_id = p_recoltare_id
    and (
      tip = 'recoltare'
      or tip_miscare = 'recoltare'
    );

  delete from public.recoltari
  where id = p_recoltare_id
    and tenant_id = v_tenant_id;
end;
$$;

notify pgrst, 'reload schema';
