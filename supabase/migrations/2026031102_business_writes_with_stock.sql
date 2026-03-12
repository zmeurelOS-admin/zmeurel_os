create or replace function public.create_recoltare_with_stock(
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
begin
  if v_user_id is null then
    raise exception 'Neautorizat';
  end if;

  select t.id
  into v_tenant_id
  from public.tenants t
  where t.owner_user_id = v_user_id
  limit 1;

  if v_tenant_id is null then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
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

  if v_kg_cal1 > 0 then
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
      data
    )
    values (
      v_tenant_id,
      p_parcela_id,
      'zmeura',
      'cal1',
      'fresh',
      'recoltare',
      v_kg_cal1,
      'recoltare',
      v_kg_cal1,
      0,
      v_recoltare.id,
      p_data
    );
  end if;

  if v_kg_cal2 > 0 then
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
      data
    )
    values (
      v_tenant_id,
      p_parcela_id,
      'zmeura',
      'cal2',
      'fresh',
      'recoltare',
      v_kg_cal2,
      'recoltare',
      0,
      v_kg_cal2,
      v_recoltare.id,
      p_data
    );
  end if;

  return v_recoltare;
end;
$$;

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
  v_cantitate numeric := round(greatest(coalesce(p_cantitate_kg, 0), 0)::numeric, 2);
  v_pret numeric := round(greatest(coalesce(p_pret_lei_kg, 0), 0)::numeric, 2);
  v_vanzare public.vanzari;
begin
  if v_user_id is null then
    raise exception 'Neautorizat';
  end if;

  select t.id
  into v_tenant_id
  from public.tenants t
  where t.owner_user_id = v_user_id
  limit 1;

  if v_tenant_id is null then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  if p_tenant_id is not null and p_tenant_id <> v_tenant_id then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  if v_cantitate <= 0 then
    raise exception 'Cantitatea trebuie sa fie mai mare decat 0.';
  end if;

  if v_pret <= 0 then
    raise exception 'Pretul trebuie sa fie mai mare decat 0.';
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
    coalesce(nullif(btrim(coalesce(p_client_sync_id, '')), ''), gen_random_uuid()::text),
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
    descriere
  )
  values (
    v_tenant_id,
    'vanzare',
    'vanzare',
    v_cantitate,
    -v_cantitate,
    0,
    v_vanzare.id,
    p_data,
    'Scadere stoc la vanzare'
  );

  return v_vanzare;
end;
$$;

create or replace function public.delete_vanzare_with_stock(
  p_vanzare_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
begin
  if v_user_id is null then
    raise exception 'Neautorizat';
  end if;

  select t.id
  into v_tenant_id
  from public.tenants t
  where t.owner_user_id = v_user_id
  limit 1;

  if v_tenant_id is null then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  delete from public.miscari_stoc ms
  where ms.tenant_id = v_tenant_id
    and ms.referinta_id = p_vanzare_id
    and (
      ms.tip = 'vanzare'
      or ms.tip_miscare = 'vanzare'
    );

  delete from public.vanzari v
  where v.id = p_vanzare_id
    and v.tenant_id = v_tenant_id;

  if not found then
    raise exception 'Vanzarea nu a fost gasita.';
  end if;
end;
$$;

notify pgrst, 'reload schema';
