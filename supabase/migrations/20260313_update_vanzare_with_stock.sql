-- DEPRECATED: Duplicat idempotent al 2026031306_update_vanzare_with_stock.sql (format A)
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

  perform pg_advisory_xact_lock(hashtext('update-vanzare-with-stock'), hashtext(v_tenant_id::text));

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

revoke all on function public.update_vanzare_with_stock(uuid, date, uuid, numeric, numeric, text, text, uuid) from public;
grant execute on function public.update_vanzare_with_stock(uuid, date, uuid, numeric, numeric, text, text, uuid) to authenticated;
grant execute on function public.update_vanzare_with_stock(uuid, date, uuid, numeric, numeric, text, text, uuid) to service_role;

notify pgrst, 'reload schema';
