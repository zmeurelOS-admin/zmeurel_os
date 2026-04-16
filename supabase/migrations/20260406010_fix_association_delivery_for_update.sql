create or replace function public.mark_association_order_delivered_atomic(
  p_order_id uuid,
  p_line_ids uuid[]
)
returns jsonb
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_today date := current_date;
  v_line_ids uuid[];
  v_expected_count integer := 0;
  v_processed_count integer := 0;
  v_has_membership boolean := false;
  v_row record;
  v_bucket record;
  v_remaining_to_allocate numeric := 0;
  v_take numeric := 0;
  v_deducted_for_line numeric := 0;
  v_has_matching_product_stock boolean := false;
  v_tenant_ids uuid[] := '{}'::uuid[];
  v_warning_messages text[] := '{}'::text[];
  v_product_name text;
  v_scope text;
begin
  if v_user_id is null then
    raise exception 'Neautorizat';
  end if;

  select exists(
    select 1
    from public.association_members am
    where am.user_id = v_user_id
  )
  into v_has_membership;

  if not v_has_membership then
    raise exception 'Doar staff-ul asociației poate marca livrările.';
  end if;

  if p_order_id is null or coalesce(array_length(p_line_ids, 1), 0) = 0 then
    raise exception 'Comanda este invalidă.';
  end if;

  select array_agg(distinct line_id order by line_id)
  into v_line_ids
  from unnest(p_line_ids) as line_id;

  v_expected_count := coalesce(array_length(v_line_ids, 1), 0);

  if v_expected_count = 0 then
    raise exception 'Comanda este invalidă.';
  end if;

  if not (p_order_id = any(v_line_ids)) then
    raise exception 'Comanda principală nu se regăsește în grupul selectat.';
  end if;

  for v_row in
    select distinct c.tenant_id
    from public.comenzi c
    where c.id = any(v_line_ids)
      and c.tenant_id is not null
    order by c.tenant_id
  loop
    perform pg_advisory_xact_lock(hashtext('stock-mutation'), hashtext(v_row.tenant_id::text));
  end loop;

  for v_row in
    select
      c.id,
      c.tenant_id,
      c.produs_id,
      c.cantitate_kg,
      c.status,
      c.data_origin,
      c.stock_deducted,
      p.nume as product_name
    from public.comenzi c
    left join public.produse p on p.id = c.produs_id
    where c.id = any(v_line_ids)
    order by c.id
    for update of c
  loop
    v_processed_count := v_processed_count + 1;

    if coalesce(v_row.data_origin, '') <> 'magazin_asociatie' then
      raise exception 'Comanda nu aparține magazinului asociației.';
    end if;

    if v_row.stock_deducted then
      raise exception 'Stocul a fost deja scăzut pentru această comandă.';
    end if;

    if v_row.status not in ('confirmata', 'in_livrare') then
      raise exception 'Doar comenzile confirmate sau în livrare pot fi marcate ca livrate.';
    end if;

    v_product_name := nullif(btrim(coalesce(v_row.product_name, '')), '');
    v_remaining_to_allocate := round(greatest(coalesce(v_row.cantitate_kg, 0), 0)::numeric, 2);
    v_deducted_for_line := 0;
    v_has_matching_product_stock := false;

    if v_row.tenant_id is not null and v_remaining_to_allocate > 0 then
      select exists(
        select 1
        from public.miscari_stoc ms
        where ms.tenant_id = v_row.tenant_id
          and ms.locatie_id is not null
          and ms.produs is not null
          and ms.calitate is not null
          and ms.depozit is not null
          and ms.tip_miscare is not null
          and ms.cantitate_kg is not null
          and v_product_name is not null
          and lower(btrim(ms.produs)) = lower(v_product_name)
        group by ms.locatie_id, ms.produs, ms.calitate, ms.depozit
        having sum(
          case
            when ms.tip_miscare in ('vanzare', 'consum', 'oferit_gratuit', 'pierdere') then -coalesce(ms.cantitate_kg, 0)
            else coalesce(ms.cantitate_kg, 0)
          end
        ) > 0
      )
      into v_has_matching_product_stock;

      v_scope := case when v_has_matching_product_stock then 'exact' else 'fallback' end;

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
        where ms.tenant_id = v_row.tenant_id
          and ms.locatie_id is not null
          and ms.produs is not null
          and ms.calitate is not null
          and ms.depozit is not null
          and ms.tip_miscare is not null
          and ms.cantitate_kg is not null
          and (
            (v_scope = 'exact' and lower(btrim(ms.produs)) = lower(v_product_name))
            or v_scope = 'fallback'
          )
        group by ms.locatie_id, ms.produs, ms.calitate, ms.depozit
        having sum(
          case
            when ms.tip_miscare in ('vanzare', 'consum', 'oferit_gratuit', 'pierdere') then -coalesce(ms.cantitate_kg, 0)
            else coalesce(ms.cantitate_kg, 0)
          end
        ) > 0
        order by available_kg desc, ms.produs asc
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
          v_row.tenant_id,
          v_bucket.locatie_id,
          v_bucket.produs,
          v_bucket.calitate,
          v_bucket.depozit,
          'vanzare',
          v_take,
          'vanzare',
          case when v_bucket.calitate = 'cal1' then -v_take else 0 end,
          case when v_bucket.calitate = 'cal2' then -v_take else 0 end,
          v_row.id,
          v_today,
          'Consum stoc la livrare comandă magazin asociație',
          'Consum stoc la livrare comandă magazin asociație'
        );

        v_deducted_for_line := round((v_deducted_for_line + v_take)::numeric, 2);
        v_remaining_to_allocate := round((v_remaining_to_allocate - v_take)::numeric, 2);
      end loop;

      if not v_has_matching_product_stock and v_product_name is not null then
        raise warning 'Nu am găsit bucket dedicat pentru produsul %, am consumat din stocul general disponibil.', v_product_name;
        v_warning_messages := array_append(
          v_warning_messages,
          format('Nu am găsit bucket dedicat pentru produsul %s, am consumat din stocul general disponibil.', v_product_name)
        );
      end if;

      if v_remaining_to_allocate > 0 then
        raise warning 'Stoc insuficient pentru linia %, produs %, lipsă % kg.', v_row.id, coalesce(v_product_name, 'produs necunoscut'), v_remaining_to_allocate;
        v_warning_messages := array_append(
          v_warning_messages,
          format(
            'Stoc insuficient pentru %s: s-au dedus %s din %s.',
            coalesce(v_product_name, 'produs necunoscut'),
            trim(to_char(v_deducted_for_line, 'FM999999990.00')),
            trim(to_char(coalesce(v_row.cantitate_kg, 0), 'FM999999990.00'))
          )
        );
      end if;
    end if;

    update public.comenzi
    set status = 'livrata',
        stock_deducted = true,
        updated_at = now()
    where id = v_row.id;

    if v_row.tenant_id is not null then
      v_tenant_ids := array_append(v_tenant_ids, v_row.tenant_id);
    end if;
  end loop;

  if v_processed_count <> v_expected_count then
    raise exception 'Nu am putut încărca toate liniile comenzii.';
  end if;

  return jsonb_build_object(
    'order_id', p_order_id,
    'updated_count', v_processed_count,
    'tenant_ids', to_jsonb(coalesce(v_tenant_ids, '{}'::uuid[])),
    'warnings', to_jsonb(coalesce(v_warning_messages, '{}'::text[]))
  );
end;
$function$
language plpgsql;
