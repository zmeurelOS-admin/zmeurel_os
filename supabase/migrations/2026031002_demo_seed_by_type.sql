-- Extend demo seed to support demo_type = berries | solar
-- Keeps existing tenant scoping and seed/reset semantics.

alter table public.parcele
  add column if not exists tip_unitate text not null default 'camp',
  add column if not exists cultura text,
  add column if not exists soi text,
  add column if not exists nr_randuri integer,
  add column if not exists distanta_intre_randuri numeric,
  add column if not exists sistem_irigare text,
  add column if not exists data_plantarii date;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'parcele_tip_unitate_check'
  ) then
    alter table public.parcele
      add constraint parcele_tip_unitate_check
      check (tip_unitate in ('camp', 'solar', 'livada'));
  end if;
end
$$;

do $$
begin
  if to_regclass('public.solar_climate_logs') is not null then
    execute 'alter table public.solar_climate_logs add column if not exists data_origin text';
    execute 'alter table public.solar_climate_logs add column if not exists demo_seed_id uuid';
    execute 'create index if not exists solar_climate_logs_tenant_demo_seed_idx on public.solar_climate_logs (tenant_id, demo_seed_id)';
  end if;

  if to_regclass('public.culture_stage_logs') is not null then
    execute 'alter table public.culture_stage_logs add column if not exists data_origin text';
    execute 'alter table public.culture_stage_logs add column if not exists demo_seed_id uuid';
    execute 'create index if not exists culture_stage_logs_tenant_demo_seed_idx on public.culture_stage_logs (tenant_id, demo_seed_id)';
  end if;
end
$$;

create or replace function public.seed_demo_for_tenant(
  p_tenant_id uuid,
  p_demo_type text default 'berries'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_owner uuid;
  v_seed_id uuid;
  v_seeded boolean := false;
  v_code text;
  v_demo_type text := lower(coalesce(nullif(trim(p_demo_type), ''), 'berries'));
  v_fixture_tag text := '[DEMO_FIXTURE_V2]';

  v_client_1 uuid;
  v_client_2 uuid;
  v_client_3 uuid;
  v_parcela_1 uuid;
  v_parcela_2 uuid;
  v_culegator_1 uuid;
  v_culegator_2 uuid;

  d_today date := current_date;
begin
  if p_tenant_id is null then
    raise exception 'TENANT_REQUIRED';
  end if;

  if v_demo_type not in ('berries', 'solar') then
    raise exception 'INVALID_DEMO_TYPE';
  end if;

  select owner_user_id
  into v_owner
  from public.tenants
  where id = p_tenant_id;

  if auth.role() = 'service_role' then
    null;
  elsif v_user_id is not null
    and v_owner is not null
    and public.user_can_manage_tenant(p_tenant_id, v_user_id)
  then
    null;
  else
    raise exception 'UNAUTHORIZED';
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
      'demo_seed_id', v_seed_id,
      'demo_type', v_demo_type
    );
  end if;

  if public.tenant_has_core_data(p_tenant_id) then
    return jsonb_build_object(
      'status', 'skipped_existing_data',
      'tenant_id', p_tenant_id,
      'demo_type', v_demo_type
    );
  end if;

  v_seed_id := gen_random_uuid();
  v_code := upper(substr(replace(v_seed_id::text, '-', ''), 1, 6));

  if to_regclass('public.parcele') is not null then
    if v_demo_type = 'solar' then
      insert into public.parcele (
        tenant_id, id_parcela, nume_parcela, tip_fruct, soi_plantat, suprafata_m2, nr_plante, an_plantare, status, observatii,
        tip_unitate, cultura, soi, nr_randuri, distanta_intre_randuri, sistem_irigare, data_plantarii,
        data_origin, demo_seed_id
      )
      values
        (
          p_tenant_id, 'DEMO-PAR-' || v_code || '-01', 'Solar 1 - Rosii', 'Legume', 'Siriana F1', 420, 680, extract(year from d_today)::int, 'Activ',
          v_fixture_tag || ' Solar demo rosii',
          'solar', 'Rosii', 'Siriana F1', 8, 0.8, 'picurare', d_today - 32,
          'demo', v_seed_id
        ),
        (
          p_tenant_id, 'DEMO-PAR-' || v_code || '-02', 'Solar 2 - Castraveti', 'Legume', 'Cornichon F1', 380, 620, extract(year from d_today)::int, 'Activ',
          v_fixture_tag || ' Solar demo castraveti',
          'solar', 'Castraveti', 'Cornichon F1', 7, 0.9, 'picurare', d_today - 24,
          'demo', v_seed_id
        );
    else
      insert into public.parcele (
        tenant_id, id_parcela, nume_parcela, tip_fruct, soi_plantat, suprafata_m2, nr_plante, an_plantare, status, observatii,
        tip_unitate, cultura, soi, nr_randuri, distanta_intre_randuri, sistem_irigare, data_plantarii,
        data_origin, demo_seed_id
      )
      values
        (
          p_tenant_id, 'DEMO-PAR-' || v_code || '-01', 'Zmeura Delniwa', 'Zmeura', 'Delniwa', 1200, 920, 2023, 'Activ',
          v_fixture_tag || ' Parcela demo Delniwa',
          'camp', null, null, null, null, null, null,
          'demo', v_seed_id
        ),
        (
          p_tenant_id, 'DEMO-PAR-' || v_code || '-02', 'Zmeura Maravilla', 'Zmeura', 'Maravilla', 1350, 1050, 2022, 'Activ',
          v_fixture_tag || ' Parcela demo Maravilla',
          'camp', null, null, null, null, null, null,
          'demo', v_seed_id
        );
    end if;

    select id into v_parcela_1
    from public.parcele
    where tenant_id = p_tenant_id
      and demo_seed_id = v_seed_id
    order by created_at asc
    limit 1;

    select id into v_parcela_2
    from public.parcele
    where tenant_id = p_tenant_id
      and demo_seed_id = v_seed_id
    order by created_at asc
    offset 1
    limit 1;
  end if;

  if to_regclass('public.culegatori') is not null then
    insert into public.culegatori (
      tenant_id, id_culegator, nume_prenume, tarif_lei_kg, data_angajare, status_activ, telefon, tip_angajare, observatii,
      data_origin, demo_seed_id
    ) values
      (
        p_tenant_id, 'DEMO-CUL-' || v_code || '-01', 'Ion Popescu', 5.25, d_today - interval '120 day', true, '0745001100', 'Sezonier',
        v_fixture_tag || ' Culegator demo',
        'demo', v_seed_id
      ),
      (
        p_tenant_id, 'DEMO-CUL-' || v_code || '-02', 'Maria Ionescu', 5.00, d_today - interval '95 day', true, '0745002200', 'Sezonier',
        v_fixture_tag || ' Culegator demo',
        'demo', v_seed_id
      );

    select id into v_culegator_1
    from public.culegatori
    where tenant_id = p_tenant_id
      and demo_seed_id = v_seed_id
    order by created_at asc
    limit 1;

    select id into v_culegator_2
    from public.culegatori
    where tenant_id = p_tenant_id
      and demo_seed_id = v_seed_id
    order by created_at asc
    offset 1
    limit 1;
  end if;

  if to_regclass('public.clienti') is not null then
    if v_demo_type = 'solar' then
      insert into public.clienti (
        tenant_id, id_client, nume_client, telefon, email, adresa, pret_negociat_lei_kg, observatii,
        data_origin, demo_seed_id
      ) values
        (p_tenant_id, 'DEMO-CLI-' || v_code || '-01', 'Bistro Verde', '0740100200', 'bistro@example.ro', 'Suceava', 16, v_fixture_tag || ' Client demo', 'demo', v_seed_id),
        (p_tenant_id, 'DEMO-CLI-' || v_code || '-02', 'Magazin de proximitate', '0740300400', 'magazin@example.ro', 'Radauti', 14, v_fixture_tag || ' Client demo', 'demo', v_seed_id),
        (p_tenant_id, 'DEMO-CLI-' || v_code || '-03', 'Piata Centrala', '0740500600', 'piata@example.ro', 'Suceava', 13, v_fixture_tag || ' Client demo', 'demo', v_seed_id);
    else
      insert into public.clienti (
        tenant_id, id_client, nume_client, telefon, email, adresa, pret_negociat_lei_kg, observatii,
        data_origin, demo_seed_id
      ) values
        (p_tenant_id, 'DEMO-CLI-' || v_code || '-01', 'Cofetaria Sweet', '0740100200', 'sweet@example.ro', 'Suceava', 25, v_fixture_tag || ' Client demo', 'demo', v_seed_id),
        (p_tenant_id, 'DEMO-CLI-' || v_code || '-02', 'Magazin Local', '0740300400', 'magazin@example.ro', 'Radauti', 23, v_fixture_tag || ' Client demo', 'demo', v_seed_id),
        (p_tenant_id, 'DEMO-CLI-' || v_code || '-03', 'Client Piata', '0740500600', 'piata@example.ro', 'Piata Centrala', 22, v_fixture_tag || ' Client demo', 'demo', v_seed_id);
    end if;

    select id into v_client_1
    from public.clienti
    where tenant_id = p_tenant_id
      and demo_seed_id = v_seed_id
    order by created_at asc
    limit 1;

    select id into v_client_2
    from public.clienti
    where tenant_id = p_tenant_id
      and demo_seed_id = v_seed_id
    order by created_at asc
    offset 1
    limit 1;

    select id into v_client_3
    from public.clienti
    where tenant_id = p_tenant_id
      and demo_seed_id = v_seed_id
    order by created_at asc
    offset 2
    limit 1;
  end if;

  if to_regclass('public.activitati_agricole') is not null then
    if v_demo_type = 'solar' then
      insert into public.activitati_agricole (
        tenant_id, id_activitate, data_aplicare, parcela_id, tip_activitate, produs_utilizat, doza, timp_pauza_zile, operator, observatii,
        data_origin, demo_seed_id
      ) values
        (p_tenant_id, 'DEMO-ACT-' || v_code || '-01', d_today - interval '2 day', v_parcela_1, 'copilit', 'lucrare manuala', '-', 0, 'Operator solar', v_fixture_tag || ' Activitate solar demo', 'demo', v_seed_id),
        (p_tenant_id, 'DEMO-ACT-' || v_code || '-02', d_today - interval '1 day', v_parcela_2, 'palisat', 'sfoara palisare', '-', 0, 'Operator solar', v_fixture_tag || ' Activitate solar demo', 'demo', v_seed_id),
        (p_tenant_id, 'DEMO-ACT-' || v_code || '-03', d_today, v_parcela_1, 'fertigare', 'NPK 20-20-20', '2 kg/1000l', 0, 'Operator solar', v_fixture_tag || ' Activitate solar demo', 'demo', v_seed_id);
    else
      insert into public.activitati_agricole (
        tenant_id, id_activitate, data_aplicare, parcela_id, tip_activitate, produs_utilizat, doza, timp_pauza_zile, operator, observatii,
        data_origin, demo_seed_id
      ) values
        (p_tenant_id, 'DEMO-ACT-' || v_code || '-01', d_today - interval '4 day', v_parcela_1, 'tratament', 'fungicid', '2 l/ha', 3, 'Operator camp', v_fixture_tag || ' Activitate camp demo', 'demo', v_seed_id),
        (p_tenant_id, 'DEMO-ACT-' || v_code || '-02', d_today - interval '2 day', v_parcela_2, 'taieri', 'manual', '-', 0, 'Operator camp', v_fixture_tag || ' Activitate camp demo', 'demo', v_seed_id),
        (p_tenant_id, 'DEMO-ACT-' || v_code || '-03', d_today - interval '1 day', v_parcela_1, 'legat', 'sfoara', '-', 0, 'Operator camp', v_fixture_tag || ' Activitate camp demo', 'demo', v_seed_id);
    end if;
  end if;

  if to_regclass('public.recoltari') is not null then
    if v_demo_type = 'solar' then
      insert into public.recoltari (
        tenant_id, id_recoltare, data, parcela_id, culegator_id, kg_cal1, kg_cal2, cantitate_kg, pret_lei_pe_kg_snapshot, valoare_munca_lei, observatii,
        data_origin, demo_seed_id
      ) values
        (p_tenant_id, 'DEMO-REC-' || v_code || '-01', d_today, v_parcela_1, v_culegator_1, 62, 8, 70, 5.25, 367.5, v_fixture_tag || ' Recoltare solar demo', 'demo', v_seed_id),
        (p_tenant_id, 'DEMO-REC-' || v_code || '-02', d_today, v_parcela_2, v_culegator_2, 48, 6, 54, 5.00, 270, v_fixture_tag || ' Recoltare solar demo', 'demo', v_seed_id);
    else
      insert into public.recoltari (
        tenant_id, id_recoltare, data, parcela_id, culegator_id, kg_cal1, kg_cal2, cantitate_kg, pret_lei_pe_kg_snapshot, valoare_munca_lei, observatii,
        data_origin, demo_seed_id
      ) values
        (p_tenant_id, 'DEMO-REC-' || v_code || '-01', d_today, v_parcela_1, v_culegator_1, 35, 5, 40, 5.25, 210, v_fixture_tag || ' Recoltare camp demo', 'demo', v_seed_id),
        (p_tenant_id, 'DEMO-REC-' || v_code || '-02', d_today, v_parcela_2, v_culegator_2, 28, 4, 32, 5.00, 160, v_fixture_tag || ' Recoltare camp demo', 'demo', v_seed_id);
    end if;
  end if;

  if to_regclass('public.cheltuieli_diverse') is not null then
    if v_demo_type = 'solar' then
      insert into public.cheltuieli_diverse (
        tenant_id, id_cheltuiala, data, categorie, descriere, suma_lei, furnizor,
        data_origin, demo_seed_id
      ) values
        (p_tenant_id, 'DEMO-CH-' || v_code || '-01', d_today, 'ingrasamant', v_fixture_tag || ' Nutrienti fertigare', 250, 'Agro Input', 'demo', v_seed_id),
        (p_tenant_id, 'DEMO-CH-' || v_code || '-02', d_today - interval '1 day', 'energie', v_fixture_tag || ' Consum ventilatie', 135, 'Furnizor Energie', 'demo', v_seed_id);
    else
      insert into public.cheltuieli_diverse (
        tenant_id, id_cheltuiala, data, categorie, descriere, suma_lei, furnizor,
        data_origin, demo_seed_id
      ) values
        (p_tenant_id, 'DEMO-CH-' || v_code || '-01', d_today, 'motorina', v_fixture_tag || ' Alimentare utilaj', 120, 'Statie carburant', 'demo', v_seed_id),
        (p_tenant_id, 'DEMO-CH-' || v_code || '-02', d_today - interval '1 day', 'ambalaje', v_fixture_tag || ' Ladite recoltare', 85, 'Depozit ambalaje', 'demo', v_seed_id);
    end if;
  end if;

  if to_regclass('public.vanzari') is not null then
    if v_demo_type = 'solar' then
      insert into public.vanzari (
        tenant_id, id_vanzare, data, client_id, cantitate_kg, pret_lei_kg, status_plata, observatii_ladite,
        data_origin, demo_seed_id
      ) values
        (p_tenant_id, 'DEMO-VNZ-' || v_code || '-01', d_today, v_client_1, 18, 16, 'incasat', v_fixture_tag || ' Vanzare solar demo', 'demo', v_seed_id),
        (p_tenant_id, 'DEMO-VNZ-' || v_code || '-02', d_today, v_client_2, 22, 14, 'incasat', v_fixture_tag || ' Vanzare solar demo', 'demo', v_seed_id),
        (p_tenant_id, 'DEMO-VNZ-' || v_code || '-03', d_today - interval '1 day', v_client_3, 16, 13, 'incasat', v_fixture_tag || ' Vanzare solar demo', 'demo', v_seed_id);
    else
      insert into public.vanzari (
        tenant_id, id_vanzare, data, client_id, cantitate_kg, pret_lei_kg, status_plata, observatii_ladite,
        data_origin, demo_seed_id
      ) values
        (p_tenant_id, 'DEMO-VNZ-' || v_code || '-01', d_today, v_client_1, 12, 25, 'incasat', v_fixture_tag || ' Vanzare berries demo', 'demo', v_seed_id),
        (p_tenant_id, 'DEMO-VNZ-' || v_code || '-02', d_today, v_client_2, 8, 23, 'incasat', v_fixture_tag || ' Vanzare berries demo', 'demo', v_seed_id),
        (p_tenant_id, 'DEMO-VNZ-' || v_code || '-03', d_today - interval '1 day', v_client_3, 10, 22, 'incasat', v_fixture_tag || ' Vanzare berries demo', 'demo', v_seed_id);
    end if;
  end if;

  if to_regclass('public.comenzi') is not null then
    if v_demo_type = 'solar' then
      insert into public.comenzi (
        tenant_id, client_id, client_nume_manual, telefon, locatie_livrare, data_comanda, data_livrare, cantitate_kg, pret_per_kg, total, status, observatii,
        data_origin, demo_seed_id
      ) values
        (p_tenant_id, v_client_1, null, '0740100200', 'Suceava', d_today, d_today, 15, 16, 240, 'programata', v_fixture_tag || ' Comanda solar demo', 'demo', v_seed_id),
        (p_tenant_id, v_client_2, null, '0740300400', 'Radauti', d_today, d_today + 1, 20, 14, 280, 'noua', v_fixture_tag || ' Comanda solar demo', 'demo', v_seed_id);
    else
      insert into public.comenzi (
        tenant_id, client_id, client_nume_manual, telefon, locatie_livrare, data_comanda, data_livrare, cantitate_kg, pret_per_kg, total, status, observatii,
        data_origin, demo_seed_id
      ) values
        (p_tenant_id, v_client_1, null, '0740100200', 'Suceava', d_today, d_today, 10, 25, 250, 'programata', v_fixture_tag || ' Comanda berries demo', 'demo', v_seed_id),
        (p_tenant_id, v_client_2, null, '0740300400', 'Radauti', d_today, d_today + 1, 14, 23, 322, 'noua', v_fixture_tag || ' Comanda berries demo', 'demo', v_seed_id);
    end if;
  end if;

  if v_demo_type = 'solar' and to_regclass('public.solar_climate_logs') is not null then
    insert into public.solar_climate_logs (
      tenant_id, unitate_id, temperatura, umiditate, observatii, created_at, data_origin, demo_seed_id
    ) values
      (p_tenant_id, v_parcela_1, 25.4, 67, v_fixture_tag || ' Climat solar 1', now() - interval '6 hour', 'demo', v_seed_id),
      (p_tenant_id, v_parcela_1, 27.1, 63, v_fixture_tag || ' Climat solar 1', now() - interval '2 hour', 'demo', v_seed_id),
      (p_tenant_id, v_parcela_2, 24.2, 71, v_fixture_tag || ' Climat solar 2', now() - interval '5 hour', 'demo', v_seed_id),
      (p_tenant_id, v_parcela_2, 26.3, 66, v_fixture_tag || ' Climat solar 2', now() - interval '1 hour', 'demo', v_seed_id);
  end if;

  if v_demo_type = 'solar' and to_regclass('public.culture_stage_logs') is not null then
    insert into public.culture_stage_logs (
      tenant_id, unitate_id, etapa, data, observatii, created_at, data_origin, demo_seed_id
    ) values
      (p_tenant_id, v_parcela_1, 'plantare', d_today - 32, v_fixture_tag || ' Etapa solar', now() - interval '30 day', 'demo', v_seed_id),
      (p_tenant_id, v_parcela_1, 'primele flori', d_today - 14, v_fixture_tag || ' Etapa solar', now() - interval '12 day', 'demo', v_seed_id),
      (p_tenant_id, v_parcela_2, 'plantare', d_today - 24, v_fixture_tag || ' Etapa solar', now() - interval '22 day', 'demo', v_seed_id),
      (p_tenant_id, v_parcela_2, 'primele flori', d_today - 10, v_fixture_tag || ' Etapa solar', now() - interval '8 day', 'demo', v_seed_id);
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
    'demo_seed_id', v_seed_id,
    'demo_type', v_demo_type
  );
end
$$;

create or replace function public.seed_demo_for_tenant(
  p_tenant_id uuid
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.seed_demo_for_tenant(p_tenant_id, 'berries');
$$;

grant execute on function public.seed_demo_for_tenant(uuid) to authenticated;
grant execute on function public.seed_demo_for_tenant(uuid) to service_role;
grant execute on function public.seed_demo_for_tenant(uuid, text) to authenticated;
grant execute on function public.seed_demo_for_tenant(uuid, text) to service_role;

notify pgrst, 'reload schema';
