-- Refresh demo seed dataset to prioritize today's operational data.
-- Idempotent for each tenant via tenants.demo_seeded guard.

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
  v_client_3 uuid;
  v_parcela_1 uuid;
  v_parcela_2 uuid;
  v_parcela_3 uuid;
  v_culegator_1 uuid;
  v_culegator_2 uuid;
  v_culegator_3 uuid;

  d_today date := current_date;
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
      (p_tenant_id, 'DEMO-PAR-' || v_code || '-01', 'Parcela Sud', 'Zmeura', 'Enrosadira', 1300, 1100, 2022, 'Activ', 'Parcela demo sud',
       'demo', v_seed_id),
      (p_tenant_id, 'DEMO-PAR-' || v_code || '-02', 'Parcela Est', 'Zmeura', 'Delniwa', 1150, 900, 2023, 'Activ', 'Parcela demo est',
       'demo', v_seed_id),
      (p_tenant_id, 'DEMO-PAR-' || v_code || '-03', 'Parcela Solar', 'Zmeura', 'Maravilla', 850, 700, 2024, 'Activ', 'Parcela demo solar',
       'demo', v_seed_id);

    select id into v_parcela_1
    from public.parcele
    where tenant_id = p_tenant_id
      and demo_seed_id = v_seed_id
      and nume_parcela = 'Parcela Sud'
    limit 1;

    select id into v_parcela_2
    from public.parcele
    where tenant_id = p_tenant_id
      and demo_seed_id = v_seed_id
      and nume_parcela = 'Parcela Est'
    limit 1;

    select id into v_parcela_3
    from public.parcele
    where tenant_id = p_tenant_id
      and demo_seed_id = v_seed_id
      and nume_parcela = 'Parcela Solar'
    limit 1;
  end if;

  if to_regclass('public.culegatori') is not null then
    insert into public.culegatori (
      tenant_id, id_culegator, nume_prenume, tarif_lei_kg, data_angajare, status_activ, telefon, tip_angajare, observatii,
      data_origin, demo_seed_id
    ) values
      (p_tenant_id, 'DEMO-CUL-' || v_code || '-01', 'Ion Popescu', 5.25, d_today - interval '120 day', true, '0745001100', 'Sezonier', 'Culegator demo',
       'demo', v_seed_id),
      (p_tenant_id, 'DEMO-CUL-' || v_code || '-02', 'Maria Ionescu', 5.00, d_today - interval '90 day', true, '0745002200', 'Sezonier', 'Culegator demo',
       'demo', v_seed_id),
      (p_tenant_id, 'DEMO-CUL-' || v_code || '-03', 'Vasile Pavel', 5.00, d_today - interval '80 day', true, '0745003300', 'Permanent', 'Culegator demo',
       'demo', v_seed_id);

    select id into v_culegator_1
    from public.culegatori
    where tenant_id = p_tenant_id and demo_seed_id = v_seed_id and nume_prenume = 'Ion Popescu'
    limit 1;

    select id into v_culegator_2
    from public.culegatori
    where tenant_id = p_tenant_id and demo_seed_id = v_seed_id and nume_prenume = 'Maria Ionescu'
    limit 1;

    select id into v_culegator_3
    from public.culegatori
    where tenant_id = p_tenant_id and demo_seed_id = v_seed_id and nume_prenume = 'Vasile Pavel'
    limit 1;
  end if;

  if to_regclass('public.clienti') is not null then
    insert into public.clienti (
      tenant_id, id_client, nume_client, telefon, email, adresa, pret_negociat_lei_kg, observatii,
      data_origin, demo_seed_id
    ) values
      (p_tenant_id, 'DEMO-CLI-' || v_code || '-01', 'Cofetaria Sweet', '0740100200', 'sweet@example.ro', 'Suceava', 25, 'Client demo',
       'demo', v_seed_id),
      (p_tenant_id, 'DEMO-CLI-' || v_code || '-02', 'Magazin Local', '0740300400', 'magazin@example.ro', 'Radauti', 23, 'Client demo',
       'demo', v_seed_id),
      (p_tenant_id, 'DEMO-CLI-' || v_code || '-03', 'Client Piata', '0740500600', 'piata@example.ro', 'Piata Centrala', 22, 'Client demo',
       'demo', v_seed_id);

    select id into v_client_1
    from public.clienti
    where tenant_id = p_tenant_id and demo_seed_id = v_seed_id and nume_client = 'Cofetaria Sweet'
    limit 1;

    select id into v_client_2
    from public.clienti
    where tenant_id = p_tenant_id and demo_seed_id = v_seed_id and nume_client = 'Magazin Local'
    limit 1;

    select id into v_client_3
    from public.clienti
    where tenant_id = p_tenant_id and demo_seed_id = v_seed_id and nume_client = 'Client Piata'
    limit 1;
  end if;

  if to_regclass('public.recoltari') is not null then
    insert into public.recoltari (
      tenant_id, id_recoltare, data, parcela_id, culegator_id, kg_cal1, kg_cal2, cantitate_kg, pret_lei_pe_kg_snapshot, valoare_munca_lei, observatii,
      data_origin, demo_seed_id
    ) values
      (p_tenant_id, 'DEMO-REC-' || v_code || '-01', d_today, v_parcela_1, v_culegator_1, 35, 5, 40, 5.25, 210, 'Recoltare demo - sud', 'demo', v_seed_id),
      (p_tenant_id, 'DEMO-REC-' || v_code || '-02', d_today, v_parcela_2, v_culegator_2, 28, 4, 32, 5.00, 160, 'Recoltare demo - est', 'demo', v_seed_id),
      (p_tenant_id, 'DEMO-REC-' || v_code || '-03', d_today, v_parcela_3, v_culegator_3, 18, 2, 20, 5.00, 100, 'Recoltare demo - solar', 'demo', v_seed_id),
      (p_tenant_id, 'DEMO-REC-' || v_code || '-04', d_today, v_parcela_1, v_culegator_2, 22, 3, 25, 5.00, 125, 'Recoltare demo - tura 2', 'demo', v_seed_id);
  end if;

  if to_regclass('public.cheltuieli_diverse') is not null then
    insert into public.cheltuieli_diverse (
      tenant_id, id_cheltuiala, data, categorie, descriere, suma_lei, furnizor,
      data_origin, demo_seed_id
    ) values
      (p_tenant_id, 'DEMO-CH-' || v_code || '-01', d_today, 'Motorina', 'Alimentare utilaj', 120, 'Statie Carburant', 'demo', v_seed_id),
      (p_tenant_id, 'DEMO-CH-' || v_code || '-02', d_today, 'Ingrasamant', 'Nutrienti fertirigare', 250, 'Agro Input', 'demo', v_seed_id);
  end if;

  if to_regclass('public.vanzari') is not null then
    insert into public.vanzari (
      tenant_id, id_vanzare, data, client_id, cantitate_kg, pret_lei_kg, status_plata, observatii_ladite,
      data_origin, demo_seed_id
    ) values
      (p_tenant_id, 'DEMO-VNZ-' || v_code || '-01', d_today, v_client_1, 12, 25, 'incasat', 'Vanzare demo cofetarie', 'demo', v_seed_id),
      (p_tenant_id, 'DEMO-VNZ-' || v_code || '-02', d_today, v_client_2, 8, 23, 'incasat', 'Vanzare demo magazin', 'demo', v_seed_id);
  end if;

  if to_regclass('public.comenzi') is not null then
    insert into public.comenzi (
      tenant_id, client_id, client_nume_manual, telefon, locatie_livrare, data_comanda, data_livrare, cantitate_kg, pret_per_kg, total, status, observatii,
      data_origin, demo_seed_id
    ) values
      (p_tenant_id, v_client_1, null, '0740100200', 'Suceava', d_today, d_today, 10, 25, 250, 'programata', 'Comanda demo Cofetaria Sweet', 'demo', v_seed_id),
      (p_tenant_id, v_client_2, null, '0740300400', 'Radauti', d_today, d_today, 14, 23, 322, 'programata', 'Comanda demo Magazin Local', 'demo', v_seed_id);
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

grant execute on function public.seed_demo_for_tenant(uuid) to authenticated;

notify pgrst, 'reload schema';
