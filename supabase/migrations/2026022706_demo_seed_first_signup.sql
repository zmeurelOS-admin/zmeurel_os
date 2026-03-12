-- Demo seed for first tenant initialization + selective demo cleanup.
-- Safe/idempotent migration.

create extension if not exists pgcrypto;

alter table public.tenants
  add column if not exists demo_seeded boolean not null default false,
  add column if not exists demo_seed_id uuid null,
  add column if not exists demo_seeded_at timestamptz null;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'parcele',
    'activitati_agricole',
    'recoltari',
    'cheltuieli_diverse',
    'vanzari',
    'vanzari_butasi',
    'vanzari_butasi_items',
    'comenzi',
    'clienti',
    'culegatori',
    'investitii',
    'miscari_stoc'
  ] loop
    if to_regclass('public.' || tbl) is not null then
      execute format(
        'alter table public.%I add column if not exists data_origin text',
        tbl
      );
      execute format(
        'alter table public.%I add column if not exists demo_seed_id uuid',
        tbl
      );
      execute format(
        'create index if not exists %I on public.%I (tenant_id, demo_seed_id)',
        tbl || '_tenant_demo_seed_idx',
        tbl
      );
    end if;
  end loop;
end
$$;

create or replace function public.user_can_manage_tenant(
  p_tenant_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allowed boolean := false;
begin
  if p_user_id is null or p_tenant_id is null then
    return false;
  end if;

  select exists (
    select 1
    from public.tenants t
    where t.id = p_tenant_id
      and t.owner_user_id = p_user_id
  ) into v_allowed;

  if v_allowed then
    return true;
  end if;

  -- Optional membership tables (if project evolves). Checked safely at runtime.
  if to_regclass('public.tenant_memberships') is not null then
    begin
      execute
        'select exists (
           select 1
           from public.tenant_memberships tm
           where tm.tenant_id = $1
             and tm.user_id = $2
         )'
      into v_allowed
      using p_tenant_id, p_user_id;
      if v_allowed then
        return true;
      end if;
    exception when others then
      -- Ignore unknown structure.
      null;
    end;
  end if;

  if to_regclass('public.tenant_users') is not null then
    begin
      execute
        'select exists (
           select 1
           from public.tenant_users tu
           where tu.tenant_id = $1
             and tu.user_id = $2
         )'
      into v_allowed
      using p_tenant_id, p_user_id;
      if v_allowed then
        return true;
      end if;
    exception when others then
      null;
    end;
  end if;

  return false;
end
$$;

create or replace function public.tenant_has_core_data(
  p_tenant_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  tbl text;
  v_has boolean;
begin
  foreach tbl in array array[
    'parcele',
    'activitati_agricole',
    'recoltari',
    'cheltuieli_diverse',
    'vanzari',
    'vanzari_butasi',
    'comenzi',
    'clienti',
    'culegatori',
    'investitii'
  ] loop
    if to_regclass('public.' || tbl) is not null then
      execute format(
        'select exists(select 1 from public.%I where tenant_id = $1)',
        tbl
      )
      into v_has
      using p_tenant_id;

      if coalesce(v_has, false) then
        return true;
      end if;
    end if;
  end loop;

  return false;
end
$$;

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
  v_suffix text;

  v_client_1 uuid;
  v_client_2 uuid;
  v_client_3 uuid;
  v_parcela_1 uuid;
  v_parcela_2 uuid;
  v_parcela_3 uuid;
  v_culegator_1 uuid;
  v_culegator_2 uuid;
  v_culegator_3 uuid;
  v_vb_1 uuid;
  v_vb_2 uuid;

  d1 date := current_date - interval '2 day';
  d2 date := current_date - interval '5 day';
  d3 date := current_date - interval '9 day';
  d4 date := current_date - interval '12 day';
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
  v_suffix := upper(substr(replace(v_seed_id::text, '-', ''), 1, 6));

  if to_regclass('public.clienti') is not null then
    insert into public.clienti (
      tenant_id, id_client, nume_client, telefon, email, adresa, pret_negociat_lei_kg, observatii,
      data_origin, demo_seed_id
    )
    values (
      p_tenant_id, 'CL-' || v_suffix || '-01', 'Piața Obor', '0722123456', 'obor@example.ro', 'București', 15.5, 'Client recurent',
      'demo', v_seed_id
    )
    returning id into v_client_1;

    insert into public.clienti (
      tenant_id, id_client, nume_client, telefon, email, adresa, pret_negociat_lei_kg, observatii,
      data_origin, demo_seed_id
    )
    values (
      p_tenant_id, 'CL-' || v_suffix || '-02', 'Cooperativa Verde', '0733001122', 'coop@example.ro', 'Suceava', 17.0, 'Plată la livrare',
      'demo', v_seed_id
    )
    returning id into v_client_2;

    insert into public.clienti (
      tenant_id, id_client, nume_client, telefon, email, adresa, pret_negociat_lei_kg, observatii,
      data_origin, demo_seed_id
    )
    values (
      p_tenant_id, 'CL-' || v_suffix || '-03', 'Livrare locală', '0744111222', null, 'Rădăuți', 16.0, 'Comenzi mici dese',
      'demo', v_seed_id
    )
    returning id into v_client_3;
  end if;

  if to_regclass('public.parcele') is not null then
    insert into public.parcele (
      tenant_id, id_parcela, nume_parcela, tip_fruct, soi_plantat, suprafata_m2, nr_plante, an_plantare, status, observatii,
      data_origin, demo_seed_id
    )
    values (
      p_tenant_id, 'PAR-' || v_suffix || '-01', 'Parcela Sud', 'Zmeură', 'Polka', 1200, 900, 2022, 'Activ', 'Expunere bună la soare',
      'demo', v_seed_id
    )
    returning id into v_parcela_1;

    insert into public.parcele (
      tenant_id, id_parcela, nume_parcela, tip_fruct, soi_plantat, suprafata_m2, nr_plante, an_plantare, status, observatii,
      data_origin, demo_seed_id
    )
    values (
      p_tenant_id, 'PAR-' || v_suffix || '-02', 'Parcela Nord', 'Zmeură', 'Tulameen', 900, 680, 2021, 'Activ', 'Productivitate stabilă',
      'demo', v_seed_id
    )
    returning id into v_parcela_2;

    insert into public.parcele (
      tenant_id, id_parcela, nume_parcela, tip_fruct, soi_plantat, suprafata_m2, nr_plante, an_plantare, status, observatii,
      data_origin, demo_seed_id
    )
    values (
      p_tenant_id, 'PAR-' || v_suffix || '-03', 'Parcela Vest', 'Mur', 'Chester', 750, 520, 2020, 'Activ', 'Necesită tăieri suplimentare',
      'demo', v_seed_id
    )
    returning id into v_parcela_3;
  end if;

  if to_regclass('public.culegatori') is not null then
    insert into public.culegatori (
      tenant_id, id_culegator, nume_prenume, tarif_lei_kg, data_angajare, status_activ, telefon, tip_angajare, observatii,
      data_origin, demo_seed_id
    )
    values (
      p_tenant_id, 'CUL-' || v_suffix || '-01', 'Maria Ionescu', 3.6, d4, true, '0755111222', 'Sezonier', null,
      'demo', v_seed_id
    )
    returning id into v_culegator_1;

    insert into public.culegatori (
      tenant_id, id_culegator, nume_prenume, tarif_lei_kg, data_angajare, status_activ, telefon, tip_angajare, observatii,
      data_origin, demo_seed_id
    )
    values (
      p_tenant_id, 'CUL-' || v_suffix || '-02', 'Vasile Pop', 3.8, d3, true, '0766222333', 'Sezonier', null,
      'demo', v_seed_id
    )
    returning id into v_culegator_2;

    insert into public.culegatori (
      tenant_id, id_culegator, nume_prenume, tarif_lei_kg, data_angajare, status_activ, telefon, tip_angajare, observatii,
      data_origin, demo_seed_id
    )
    values (
      p_tenant_id, 'CUL-' || v_suffix || '-03', 'Ana Pavel', 4.0, d2, true, '0777333444', 'Permanent', 'Coordonator echipă',
      'demo', v_seed_id
    )
    returning id into v_culegator_3;
  end if;

  if to_regclass('public.activitati_agricole') is not null then
    insert into public.activitati_agricole (
      tenant_id, id_activitate, data_aplicare, parcela_id, tip_activitate, produs_utilizat, doza, timp_pauza_zile, operator, observatii,
      data_origin, demo_seed_id
    ) values
      (p_tenant_id, 'AA-' || v_suffix || '-01', d4, v_parcela_1, 'Tratament Fungicid', 'Fungicid X', '2 l/ha', 7, 'Andrei', 'Aplicare dimineața', 'demo', v_seed_id),
      (p_tenant_id, 'AA-' || v_suffix || '-02', d3, v_parcela_2, 'Fertilizare Foliara', 'Îngrășământ foliar', '1.5 l/ha', 3, 'Andrei', null, 'demo', v_seed_id),
      (p_tenant_id, 'AA-' || v_suffix || '-03', d2, v_parcela_3, 'Irigare', 'Sistem picurare', null, 0, 'Operator tură', '45 minute/zonă', 'demo', v_seed_id);
  end if;

  if to_regclass('public.recoltari') is not null then
    insert into public.recoltari (
      tenant_id, id_recoltare, data, parcela_id, culegator_id, kg_cal1, kg_cal2, cantitate_kg, pret_lei_pe_kg_snapshot, valoare_munca_lei, observatii,
      data_origin, demo_seed_id
    ) values
      (p_tenant_id, 'REC-' || v_suffix || '-01', d2, v_parcela_1, v_culegator_1, 86, 14, 100, 3.6, 360, 'Recoltare dimineață', 'demo', v_seed_id),
      (p_tenant_id, 'REC-' || v_suffix || '-02', d1, v_parcela_2, v_culegator_2, 74, 16, 90, 3.8, 342, 'Calitate bună', 'demo', v_seed_id),
      (p_tenant_id, 'REC-' || v_suffix || '-03', d1, v_parcela_3, v_culegator_3, 58, 12, 70, 4.0, 280, 'Lot mixt', 'demo', v_seed_id);
  end if;

  if to_regclass('public.cheltuieli_diverse') is not null then
    insert into public.cheltuieli_diverse (
      tenant_id, id_cheltuiala, data, categorie, descriere, suma_lei, furnizor,
      data_origin, demo_seed_id
    ) values
      (p_tenant_id, 'CH-' || v_suffix || '-01', d4, 'Tratamente', 'Fungicid + adjuvant', 420, 'Agro Input SRL', 'demo', v_seed_id),
      (p_tenant_id, 'CH-' || v_suffix || '-02', d3, 'Transport', 'Motorină livrări locale', 180, 'Stație carburanți', 'demo', v_seed_id),
      (p_tenant_id, 'CH-' || v_suffix || '-03', d1, 'Ambalaje', 'Lădițe + etichete', 260, 'Depozit ambalaje', 'demo', v_seed_id);
  end if;

  if to_regclass('public.vanzari') is not null then
    insert into public.vanzari (
      tenant_id, id_vanzare, data, client_id, cantitate_kg, pret_lei_kg, status_plata, observatii_ladite,
      data_origin, demo_seed_id
    ) values
      (p_tenant_id, 'VNZ-' || v_suffix || '-01', d2, v_client_1, 80, 16.5, 'incasat', 'Lădițe albastre', 'demo', v_seed_id),
      (p_tenant_id, 'VNZ-' || v_suffix || '-02', d1, v_client_2, 65, 17.0, 'partial', 'Factură 15 zile', 'demo', v_seed_id),
      (p_tenant_id, 'VNZ-' || v_suffix || '-03', d1, v_client_3, 30, 18.0, 'neincasat', 'Livrare directă', 'demo', v_seed_id);
  end if;

  if to_regclass('public.vanzari_butasi') is not null then
    insert into public.vanzari_butasi (
      tenant_id, id_vanzare_butasi, data, data_comanda, data_livrare_estimata, client_id, parcela_sursa_id, tip_fruct, soi_butasi,
      cantitate_butasi, pret_unitar_lei, total_lei, status, adresa_livrare, avans_suma, avans_data, observatii,
      data_origin, demo_seed_id
    ) values
      (p_tenant_id, 'VNB-' || v_suffix || '-01', d3, d4, d1, v_client_1, v_parcela_1, 'Zmeură', 'Polka', 500, 4.2, 2100, 'confirmata', 'Suceava', 500, d3, null, 'demo', v_seed_id)
    returning id into v_vb_1;

    insert into public.vanzari_butasi (
      tenant_id, id_vanzare_butasi, data, data_comanda, data_livrare_estimata, client_id, parcela_sursa_id, tip_fruct, soi_butasi,
      cantitate_butasi, pret_unitar_lei, total_lei, status, adresa_livrare, avans_suma, avans_data, observatii,
      data_origin, demo_seed_id
    ) values
      (p_tenant_id, 'VNB-' || v_suffix || '-02', d2, d3, current_date + interval '3 day', v_client_2, v_parcela_2, 'Zmeură', 'Tulameen', 350, 4.5, 1575, 'noua', 'Botoșani', 0, null, 'Plată la livrare', 'demo', v_seed_id)
    returning id into v_vb_2;
  end if;

  if to_regclass('public.vanzari_butasi_items') is not null then
    if v_vb_1 is not null then
      insert into public.vanzari_butasi_items (
        tenant_id, comanda_id, soi, cantitate, pret_unitar, subtotal,
        data_origin, demo_seed_id
      )
      values
        (p_tenant_id, v_vb_1, 'Polka', 500, 4.2, 2100, 'demo', v_seed_id);
    end if;

    if v_vb_2 is not null then
      insert into public.vanzari_butasi_items (
        tenant_id, comanda_id, soi, cantitate, pret_unitar, subtotal,
        data_origin, demo_seed_id
      )
      values
        (p_tenant_id, v_vb_2, 'Tulameen', 350, 4.5, 1575, 'demo', v_seed_id);
    end if;
  end if;

  if to_regclass('public.comenzi') is not null then
    insert into public.comenzi (
      tenant_id, client_id, client_nume_manual, telefon, locatie_livrare, data_comanda, data_livrare, cantitate_kg, pret_per_kg, total, status, observatii,
      data_origin, demo_seed_id
    ) values
      (p_tenant_id, v_client_1, null, '0722123456', 'Suceava', d3, d1, 45, 16.5, 742.5, 'confirmata', 'Livrare dimineața', 'demo', v_seed_id),
      (p_tenant_id, v_client_2, null, '0733001122', 'Fălticeni', d2, current_date + interval '2 day', 35, 17.0, 595, 'programata', 'Cutii 250g', 'demo', v_seed_id),
      (p_tenant_id, null, 'Client local', '0744999000', 'Piață locală', d1, current_date + interval '1 day', 20, 18.0, 360, 'noua', null, 'demo', v_seed_id);
  end if;

  if to_regclass('public.investitii') is not null then
    insert into public.investitii (
      tenant_id, id_investitie, data, parcela_id, categorie, furnizor, descriere, suma_lei,
      data_origin, demo_seed_id
    ) values
      (p_tenant_id, 'INV-' || v_suffix || '-01', d4, v_parcela_1, 'Sistem irigare', 'Irigatii Nord', 'Bandă picurare', 1200, 'demo', v_seed_id),
      (p_tenant_id, 'INV-' || v_suffix || '-02', d2, v_parcela_2, 'Echipamente', 'Agro Utilaje', 'Foarfeci profesionale', 650, 'demo', v_seed_id);
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
    'vanzari_butasi_items',
    'miscari_stoc',
    'comenzi',
    'vanzari_butasi',
    'vanzari',
    'recoltari',
    'cheltuieli_diverse',
    'activitati_agricole',
    'investitii',
    'clienti',
    'culegatori',
    'parcele'
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

grant execute on function public.user_can_manage_tenant(uuid, uuid) to authenticated;
grant execute on function public.tenant_has_core_data(uuid) to authenticated;
grant execute on function public.seed_demo_for_tenant(uuid) to authenticated;
grant execute on function public.delete_demo_for_tenant(uuid) to authenticated;

notify pgrst, 'reload schema';
