-- Refresh demo seed dataset for new tenants.
-- Idempotent: only replaces functions.

create or replace function public.seed_demo_for_tenant(
  p_tenant_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_seed_id uuid;
  v_seeded boolean := false;
  v_code text;

  v_client_1 uuid;
  v_client_2 uuid;
  v_parcela_1 uuid;
  v_parcela_2 uuid;
  v_culegator_1 uuid;
  v_culegator_2 uuid;
  v_culegator_3 uuid;

  d_today date := current_date;
  d1 date := current_date - interval '1 day';
  d2 date := current_date - interval '2 day';
  d3 date := current_date - interval '3 day';
  d4 date := current_date - interval '4 day';
  d5 date := current_date - interval '5 day';
  d6 date := current_date - interval '6 day';
  d7 date := current_date - interval '7 day';
  m1 date := current_date - interval '14 day';
  m2 date := current_date - interval '21 day';
  m3 date := current_date - interval '30 day';
  m4 date := current_date - interval '41 day';
  m5 date := current_date - interval '55 day';
begin
  if v_user_id is null then
    raise exception 'UNAUTHORIZED';
  end if;

  if p_tenant_id is null then
    raise exception 'TENANT_REQUIRED';
  end if;

  if not public.user_can_manage_tenant(p_tenant_id, v_user_id) then
    raise exception 'FORBIDDEN';
  end if;

  select t.demo_seeded, t.demo_seed_id
  into v_seeded, v_seed_id
  from public.tenants t
  where t.id = p_tenant_id
  for update;

  if v_seeded = true then
    return jsonb_build_object(
      'status', 'already_seeded',
      'tenant_id', p_tenant_id,
      'demo_seed_id', v_seed_id
    );
  end if;

  if public.tenant_has_core_data(p_tenant_id) then
    return jsonb_build_object(
      'status', 'skipped_existing_data',
      'tenant_id', p_tenant_id
    );
  end if;

  v_seed_id := gen_random_uuid();
  v_code := upper(substr(replace(v_seed_id::text, '-', ''), 1, 6));

  if to_regclass('public.parcele') is not null then
    insert into public.parcele (
      tenant_id, id_parcela, nume_parcela, tip_fruct, soi_plantat, suprafata_m2, nr_plante, an_plantare, status, observatii,
      data_origin, demo_seed_id
    )
    values
      (p_tenant_id, 'DEMO-PAR-' || v_code || '-01', 'Parcela Nord', 'Zmeura', 'Maravilla', 1500, 1200, 2022, 'Activ', 'Parcela demo nord',
       'demo', v_seed_id),
      (p_tenant_id, 'DEMO-PAR-' || v_code || '-02', 'Parcela Sud', 'Zmeura', 'Delniwa', 1000, 800, 2023, 'Activ', 'Parcela demo sud',
       'demo', v_seed_id);

    select id
    into v_parcela_1
    from public.parcele
    where tenant_id = p_tenant_id
      and demo_seed_id = v_seed_id
      and nume_parcela = 'Parcela Nord'
    limit 1;

    select id
    into v_parcela_2
    from public.parcele
    where tenant_id = p_tenant_id
      and demo_seed_id = v_seed_id
      and nume_parcela = 'Parcela Sud'
    limit 1;
  end if;

  if to_regclass('public.culegatori') is not null then
    insert into public.culegatori (
      tenant_id, id_culegator, nume_prenume, tarif_lei_kg, data_angajare, status_activ, telefon, tip_angajare, observatii,
      data_origin, demo_seed_id
    ) values
      (p_tenant_id, 'DEMO-CUL-' || v_code || '-01', 'Maria Popescu', 3.5, m5, true, '0745001100', 'Sezonier', 'Culegator demo',
       'demo', v_seed_id),
      (p_tenant_id, 'DEMO-CUL-' || v_code || '-02', 'Ion Moldovan', 3.0, m4, true, '0745002200', 'Sezonier', 'Culegator demo',
       'demo', v_seed_id),
      (p_tenant_id, 'DEMO-CUL-' || v_code || '-03', 'Ana Rusu', 3.5, m3, true, '0745003300', 'Permanent', 'Culegator demo',
       'demo', v_seed_id);

    select id into v_culegator_1
    from public.culegatori
    where tenant_id = p_tenant_id and demo_seed_id = v_seed_id and nume_prenume = 'Maria Popescu'
    limit 1;

    select id into v_culegator_2
    from public.culegatori
    where tenant_id = p_tenant_id and demo_seed_id = v_seed_id and nume_prenume = 'Ion Moldovan'
    limit 1;

    select id into v_culegator_3
    from public.culegatori
    where tenant_id = p_tenant_id and demo_seed_id = v_seed_id and nume_prenume = 'Ana Rusu'
    limit 1;
  end if;

  if to_regclass('public.clienti') is not null then
    insert into public.clienti (
      tenant_id, id_client, nume_client, telefon, email, adresa, pret_negociat_lei_kg, observatii,
      data_origin, demo_seed_id
    ) values
      (p_tenant_id, 'DEMO-CLI-' || v_code || '-01', 'Magazin BioFruct', '0740100200', 'biofruct@example.ro', 'Suceava', 18, 'Client demo',
       'demo', v_seed_id),
      (p_tenant_id, 'DEMO-CLI-' || v_code || '-02', 'Restaurant La Livada', '0740300400', 'restaurant@example.ro', 'Radauti', 20, 'Client demo',
       'demo', v_seed_id);

    select id into v_client_1
    from public.clienti
    where tenant_id = p_tenant_id and demo_seed_id = v_seed_id and nume_client = 'Magazin BioFruct'
    limit 1;

    select id into v_client_2
    from public.clienti
    where tenant_id = p_tenant_id and demo_seed_id = v_seed_id and nume_client = 'Restaurant La Livada'
    limit 1;
  end if;

  if to_regclass('public.activitati_agricole') is not null then
    insert into public.activitati_agricole (
      tenant_id, id_activitate, data_aplicare, parcela_id, tip_activitate, produs_utilizat, doza, timp_pauza_zile, operator, observatii,
      data_origin, demo_seed_id
    ) values
      (p_tenant_id, 'DEMO-ACT-' || v_code || '-01', m5, v_parcela_1, 'Tratament Fungicid', 'Signum', '1 kg/ha', 7, 'Andrei', 'Aplicare dupa ploaie', 'demo', v_seed_id),
      (p_tenant_id, 'DEMO-ACT-' || v_code || '-02', m4, v_parcela_2, 'Tratament Fungicid', 'Ortiva Top', '1 l/ha', 7, 'Andrei', 'Preventiv', 'demo', v_seed_id),
      (p_tenant_id, 'DEMO-ACT-' || v_code || '-03', m3, v_parcela_1, 'Fertilizare Foliara', 'Ingrasamant foliar NPK', '2 l/ha', 0, 'Andrei', 'Faza vegetativa', 'demo', v_seed_id),
      (p_tenant_id, 'DEMO-ACT-' || v_code || '-04', m2, v_parcela_2, 'Fertilizare Foliara', 'Calciu + bor', '1.5 l/ha', 0, 'Andrei', 'Inainte de coacere', 'demo', v_seed_id),
      (p_tenant_id, 'DEMO-ACT-' || v_code || '-05', m1, v_parcela_1, 'Tundere/Curatare', 'Foarfeca profesionala', null, 0, 'Andrei', 'Taiere de intretinere', 'demo', v_seed_id);
  end if;

  if to_regclass('public.recoltari') is not null then
    insert into public.recoltari (
      tenant_id, id_recoltare, data, parcela_id, culegator_id, kg_cal1, kg_cal2, cantitate_kg, pret_lei_pe_kg_snapshot, valoare_munca_lei, observatii,
      data_origin, demo_seed_id
    ) values
      (p_tenant_id, 'DEMO-REC-' || v_code || '-01', d7, v_parcela_1, v_culegator_1, 24, 6, 30, 18, 105, 'Tura dimineata', 'demo', v_seed_id),
      (p_tenant_id, 'DEMO-REC-' || v_code || '-02', d7, v_parcela_2, v_culegator_2, 20, 5, 25, 18, 75, 'Tura dimineata', 'demo', v_seed_id),
      (p_tenant_id, 'DEMO-REC-' || v_code || '-03', d6, v_parcela_1, v_culegator_3, 28, 7, 35, 19, 122.5, 'Calitate buna', 'demo', v_seed_id),
      (p_tenant_id, 'DEMO-REC-' || v_code || '-04', d5, v_parcela_2, v_culegator_1, 18, 5, 23, 18, 80.5, 'Zi calduroasa', 'demo', v_seed_id),
      (p_tenant_id, 'DEMO-REC-' || v_code || '-05', d4, v_parcela_1, v_culegator_2, 30, 8, 38, 20, 114, 'Lot productiv', 'demo', v_seed_id),
      (p_tenant_id, 'DEMO-REC-' || v_code || '-06', d3, v_parcela_2, v_culegator_3, 22, 6, 28, 19, 98, 'Sortare in camp', 'demo', v_seed_id),
      (p_tenant_id, 'DEMO-REC-' || v_code || '-07', d2, v_parcela_1, v_culegator_1, 33, 9, 42, 20, 147, 'Varf de productie', 'demo', v_seed_id),
      (p_tenant_id, 'DEMO-REC-' || v_code || '-08', d1, v_parcela_2, v_culegator_2, 26, 7, 33, 19, 99, 'Livrare rapida', 'demo', v_seed_id),
      (p_tenant_id, 'DEMO-REC-' || v_code || '-09', d_today, v_parcela_1, v_culegator_3, 29, 8, 37, 20, 129.5, 'Recoltare curenta', 'demo', v_seed_id);
  end if;

  if to_regclass('public.cheltuieli_diverse') is not null then
    insert into public.cheltuieli_diverse (
      tenant_id, id_cheltuiala, data, categorie, descriere, suma_lei, furnizor,
      data_origin, demo_seed_id
    ) values
      (p_tenant_id, 'DEMO-CH-' || v_code || '-01', m5, 'Tratamente', 'Tratament fitosanitar Signum', 450, 'Agro Shop Suceava', 'demo', v_seed_id),
      (p_tenant_id, 'DEMO-CH-' || v_code || '-02', m3, 'Fertilizare', 'Ingrasamant foliar', 320, 'Fitofarm', 'demo', v_seed_id),
      (p_tenant_id, 'DEMO-CH-' || v_code || '-03', d4, 'Ambalaje', 'Caserole si etichete', 180, 'Ambalaje Nord', 'demo', v_seed_id),
      (p_tenant_id, 'DEMO-CH-' || v_code || '-04', d2, 'Transport', 'Motorina livrari', 250, 'OMV', 'demo', v_seed_id);
  end if;

  if to_regclass('public.vanzari') is not null then
    insert into public.vanzari (
      tenant_id, id_vanzare, data, client_id, cantitate_kg, pret_lei_kg, status_plata, observatii_ladite,
      data_origin, demo_seed_id
    ) values
      (p_tenant_id, 'DEMO-VNZ-' || v_code || '-01', d4, v_client_1, 80, 18, 'incasat', 'Livrare standard', 'demo', v_seed_id),
      (p_tenant_id, 'DEMO-VNZ-' || v_code || '-02', d2, v_client_2, 45, 20, 'partial', 'Livrare restaurant', 'demo', v_seed_id),
      (p_tenant_id, 'DEMO-VNZ-' || v_code || '-03', d1, v_client_1, 30, 22, 'neincasat', 'Comanda urgenta', 'demo', v_seed_id);
  end if;

  if to_regclass('public.comenzi') is not null then
    insert into public.comenzi (
      tenant_id, client_id, client_nume_manual, telefon, locatie_livrare, data_comanda, data_livrare, cantitate_kg, pret_per_kg, total, status, observatii,
      data_origin, demo_seed_id
    ) values
      (p_tenant_id, v_client_1, null, '0740100200', 'Suceava', d2, d1, 55, 18, 990, 'confirmata', 'Livrare la ora 09:00', 'demo', v_seed_id),
      (p_tenant_id, v_client_2, null, '0740300400', 'Radauti', d1, d_today + interval '1 day', 35, 20, 700, 'noua', 'In asteptare confirmare finala', 'demo', v_seed_id);
  end if;

  update public.tenants
  set
    demo_seeded = true,
    demo_seed_id = v_seed_id,
    demo_seeded_at = now(),
    updated_at = now()
  where id = p_tenant_id;

  return jsonb_build_object(
    'status', 'seeded',
    'tenant_id', p_tenant_id,
    'demo_seed_id', v_seed_id
  );
end
$$;

create or replace function public.delete_demo_for_tenant(
  p_tenant_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_seed_id uuid;
  v_deleted bigint := 0;
  v_count bigint := 0;
  tbl text;
begin
  if v_user_id is null then
    raise exception 'UNAUTHORIZED';
  end if;

  if p_tenant_id is null then
    raise exception 'TENANT_REQUIRED';
  end if;

  if not public.user_can_manage_tenant(p_tenant_id, v_user_id) then
    raise exception 'FORBIDDEN';
  end if;

  select t.demo_seed_id
  into v_seed_id
  from public.tenants t
  where t.id = p_tenant_id
  for update;

  foreach tbl in array array[
    'comenzi',
    'vanzari',
    'vanzari_butasi_items',
    'vanzari_butasi',
    'recoltari',
    'cheltuieli_diverse',
    'activitati_agricole',
    'culegatori',
    'clienti',
    'parcele',
    'investitii',
    'miscari_stoc'
  ] loop
    if to_regclass('public.' || tbl) is not null then
      execute format(
        'with deleted_rows as (
           delete from public.%I
           where tenant_id = $1
             and (
               data_origin = ''demo''
               or ($2 is not null and demo_seed_id = $2)
             )
           returning 1
         )
         select count(*) from deleted_rows',
        tbl
      )
      into v_count
      using p_tenant_id, v_seed_id;

      v_deleted := v_deleted + coalesce(v_count, 0);
    end if;
  end loop;

  update public.tenants
  set
    demo_seeded = false,
    demo_seed_id = null,
    demo_seeded_at = null,
    updated_at = now()
  where id = p_tenant_id;

  return jsonb_build_object(
    'status', 'deleted',
    'tenant_id', p_tenant_id,
    'deleted_rows', v_deleted
  );
end
$$;

grant execute on function public.seed_demo_for_tenant(uuid) to authenticated;
grant execute on function public.delete_demo_for_tenant(uuid) to authenticated;

notify pgrst, 'reload schema';
