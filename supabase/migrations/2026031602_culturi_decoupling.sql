-- ============================================================
-- 20260316_culturi_decoupling.sql
-- Decuplare cultură de infrastructura solar (1-to-many).
-- Creează tabelul `culturi`, migrează datele existente,
-- adaugă cultura_id la culture_stage_logs, recoltari,
-- activitati_agricole și actualizează seed-ul demo solar.
--
-- ROLLBACK (rulat manual la nevoie):
--   DROP TABLE IF EXISTS public.culturi CASCADE;
--   ALTER TABLE public.recoltari DROP COLUMN IF EXISTS cultura_id;
--   ALTER TABLE public.activitati_agricole DROP COLUMN IF EXISTS cultura_id;
--   ALTER TABLE public.culture_stage_logs DROP COLUMN IF EXISTS cultura_id;
--   DROP FUNCTION IF EXISTS public.validate_suprafata_culturi;
-- ============================================================

-- ============================================================
-- 1. CREARE TABEL culturi
-- ============================================================
create table if not exists public.culturi (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null references public.tenants(id) on delete cascade,
  solar_id               uuid not null references public.parcele(id) on delete cascade,
  tip_planta             text not null,
  soi                    text,
  suprafata_ocupata      numeric,
  nr_plante              integer,
  nr_randuri             integer,
  distanta_intre_randuri numeric,
  sistem_irigare         text,
  data_plantarii         date,
  stadiu                 text not null default 'crestere',
  activa                 boolean not null default true,
  data_desfiintare       date,
  motiv_desfiintare      text,
  observatii             text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  data_origin            text,
  demo_seed_id           uuid
);

create index if not exists culturi_solar_id_idx
  on public.culturi (solar_id);

create index if not exists culturi_tenant_id_idx
  on public.culturi (tenant_id);

create index if not exists culturi_tenant_solar_idx
  on public.culturi (tenant_id, solar_id);

create index if not exists culturi_activa_idx
  on public.culturi (activa) where activa = true;

create index if not exists culturi_demo_seed_idx
  on public.culturi (tenant_id, demo_seed_id);

create index if not exists culturi_tip_planta_idx
  on public.culturi (lower(tip_planta));

-- ============================================================
-- 2. TRIGGER updated_at PE culturi
-- ============================================================
create or replace function public.set_culturi_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists culturi_updated_at on public.culturi;
create trigger culturi_updated_at
  before update on public.culturi
  for each row execute function public.set_culturi_updated_at();

-- ============================================================
-- 3. RLS PE culturi (pattern standard: current_tenant_id())
-- ============================================================
alter table public.culturi enable row level security;

drop policy if exists culturi_select on public.culturi;
create policy culturi_select on public.culturi
  for select to authenticated
  using (tenant_id = public.current_tenant_id());

drop policy if exists culturi_insert on public.culturi;
create policy culturi_insert on public.culturi
  for insert to authenticated
  with check (tenant_id = public.current_tenant_id());

drop policy if exists culturi_update on public.culturi;
create policy culturi_update on public.culturi
  for update to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

drop policy if exists culturi_delete on public.culturi;
create policy culturi_delete on public.culturi
  for delete to authenticated
  using (tenant_id = public.current_tenant_id());

-- Superadmin bypass
drop policy if exists culturi_superadmin_select on public.culturi;
create policy culturi_superadmin_select on public.culturi
  for select using (public.is_superadmin());

drop policy if exists culturi_superadmin_insert on public.culturi;
create policy culturi_superadmin_insert on public.culturi
  for insert with check (public.is_superadmin());

drop policy if exists culturi_superadmin_update on public.culturi;
create policy culturi_superadmin_update on public.culturi
  for update using (public.is_superadmin()) with check (public.is_superadmin());

drop policy if exists culturi_superadmin_delete on public.culturi;
create policy culturi_superadmin_delete on public.culturi
  for delete using (public.is_superadmin());

-- ============================================================
-- 4. FUNCȚIE VALIDARE SUPRAFAȚĂ
-- ============================================================
create or replace function public.validate_suprafata_culturi(
  p_solar_id      uuid,
  p_suprafata     numeric,
  p_cultura_id    uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_suprafata_totala  numeric;
  v_suprafata_ocupata numeric;
begin
  select suprafata_m2
  into v_suprafata_totala
  from public.parcele
  where id = p_solar_id;

  if v_suprafata_totala is null then
    return false;
  end if;

  select coalesce(sum(suprafata_ocupata), 0)
  into v_suprafata_ocupata
  from public.culturi
  where solar_id = p_solar_id
    and activa = true
    and (p_cultura_id is null or id != p_cultura_id);

  return (v_suprafata_ocupata + p_suprafata) <= v_suprafata_totala;
end;
$$;

grant execute on function public.validate_suprafata_culturi(uuid, numeric, uuid) to authenticated;

drop trigger if exists culturi_check_suprafata on public.culturi;
create trigger culturi_check_suprafata
  before insert or update of suprafata_ocupata, solar_id on public.culturi
  for each row execute function public.check_culturi_suprafata();

-- ============================================================
-- 5. ADAUGĂ cultura_id LA culture_stage_logs
-- ============================================================
alter table public.culture_stage_logs
  add column if not exists cultura_id uuid references public.culturi(id) on delete cascade;

create index if not exists culture_stage_logs_cultura_id_idx
  on public.culture_stage_logs (cultura_id);

-- ============================================================
-- 6. ADAUGĂ cultura_id LA recoltari ȘI activitati_agricole
-- ============================================================
alter table public.recoltari
  add column if not exists cultura_id uuid references public.culturi(id) on delete set null;

create index if not exists recoltari_cultura_id_idx
  on public.recoltari (cultura_id);

alter table public.activitati_agricole
  add column if not exists cultura_id uuid references public.culturi(id) on delete set null;

create index if not exists activitati_agricole_cultura_id_idx
  on public.activitati_agricole (cultura_id);

-- ============================================================
-- 7. MIGRARE DATE: parcele(solar) → culturi
-- ============================================================
insert into public.culturi (
  tenant_id, solar_id, tip_planta, soi,
  nr_plante, nr_randuri, distanta_intre_randuri,
  sistem_irigare, data_plantarii, stadiu,
  activa, observatii, created_at, updated_at,
  data_origin, demo_seed_id
)
select
  p.tenant_id,
  p.id                                                      as solar_id,
  coalesce(p.cultura, p.tip_fruct, 'Necunoscută')          as tip_planta,
  coalesce(p.soi, p.soi_plantat)                           as soi,
  p.nr_plante,
  p.nr_randuri,
  p.distanta_intre_randuri,
  p.sistem_irigare,
  p.data_plantarii,
  'crestere'                                                as stadiu,
  true                                                      as activa,
  null                                                      as observatii,
  p.created_at,
  p.updated_at,
  p.data_origin,
  p.demo_seed_id
from public.parcele p
where p.tip_unitate = 'solar'
  and (p.cultura is not null or p.tip_fruct is not null)
  -- evitare duplicate dacă migrarea e rulată de mai multe ori
  and not exists (
    select 1 from public.culturi c where c.solar_id = p.id
  );

-- ============================================================
-- 8. ACTUALIZARE cultura_id ÎN culture_stage_logs (date existente)
-- Asociem fiecare stage log cu prima cultură activă din acel solar.
-- ============================================================
update public.culture_stage_logs csl
set cultura_id = c.id
from public.culturi c
where c.solar_id = csl.unitate_id
  and c.activa = true
  and csl.cultura_id is null
  and exists (
    select 1 from public.parcele p
    where p.id = csl.unitate_id and p.tip_unitate = 'solar'
  );

-- ============================================================
-- 9. ACTUALIZARE cultura_id ÎN recoltari (date existente solar)
-- ============================================================
update public.recoltari r
set cultura_id = c.id
from public.culturi c
where c.solar_id = r.parcela_id
  and c.activa = true
  and r.cultura_id is null
  and exists (
    select 1 from public.parcele p
    where p.id = r.parcela_id and p.tip_unitate = 'solar'
  );

-- ============================================================
-- 10. ACTUALIZARE cultura_id ÎN activitati_agricole (date existente solar)
-- ============================================================
update public.activitati_agricole a
set cultura_id = c.id
from public.culturi c
where c.solar_id = a.parcela_id
  and c.activa = true
  and a.cultura_id is null
  and exists (
    select 1 from public.parcele p
    where p.id = a.parcela_id and p.tip_unitate = 'solar'
  );

-- ============================================================
-- 11. ACTUALIZARE seed_demo_for_tenant — adaugă culturi pentru solar
-- ============================================================
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
  v_cultura_1 uuid;
  v_cultura_2 uuid;
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
    where tenant_id = p_tenant_id and demo_seed_id = v_seed_id
    order by created_at asc limit 1;

    select id into v_parcela_2
    from public.parcele
    where tenant_id = p_tenant_id and demo_seed_id = v_seed_id
    order by created_at asc offset 1 limit 1;
  end if;

  -- Creare culturi pentru demo solar
  if v_demo_type = 'solar' and to_regclass('public.culturi') is not null
     and v_parcela_1 is not null and v_parcela_2 is not null then
    insert into public.culturi (
      tenant_id, solar_id, tip_planta, soi, nr_plante, nr_randuri, distanta_intre_randuri,
      sistem_irigare, data_plantarii, stadiu, activa,
      data_origin, demo_seed_id
    ) values
      (p_tenant_id, v_parcela_1, 'Roșii', 'Siriana F1', 680, 8, 0.8, 'picurare', d_today - 32, 'inflorire', true, 'demo', v_seed_id),
      (p_tenant_id, v_parcela_2, 'Castraveți', 'Cornichon F1', 620, 7, 0.9, 'picurare', d_today - 24, 'crestere', true, 'demo', v_seed_id);

    select id into v_cultura_1
    from public.culturi
    where tenant_id = p_tenant_id and demo_seed_id = v_seed_id
    order by created_at asc limit 1;

    select id into v_cultura_2
    from public.culturi
    where tenant_id = p_tenant_id and demo_seed_id = v_seed_id
    order by created_at asc offset 1 limit 1;
  end if;

  if to_regclass('public.culegatori') is not null then
    insert into public.culegatori (
      tenant_id, id_culegator, nume_prenume, tarif_lei_kg, data_angajare, status_activ, telefon, tip_angajare, observatii,
      data_origin, demo_seed_id
    ) values
      (p_tenant_id, 'DEMO-CUL-' || v_code || '-01', 'Ion Popescu', 5.25, d_today - interval '120 day', true, '0745001100', 'Sezonier', v_fixture_tag || ' Culegator demo', 'demo', v_seed_id),
      (p_tenant_id, 'DEMO-CUL-' || v_code || '-02', 'Maria Ionescu', 5.00, d_today - interval '95 day', true, '0745002200', 'Sezonier', v_fixture_tag || ' Culegator demo', 'demo', v_seed_id);

    select id into v_culegator_1
    from public.culegatori
    where tenant_id = p_tenant_id and demo_seed_id = v_seed_id
    order by created_at asc limit 1;

    select id into v_culegator_2
    from public.culegatori
    where tenant_id = p_tenant_id and demo_seed_id = v_seed_id
    order by created_at asc offset 1 limit 1;
  end if;

  if to_regclass('public.clienti') is not null then
    if v_demo_type = 'solar' then
      insert into public.clienti (tenant_id, id_client, nume_client, telefon, email, adresa, pret_negociat_lei_kg, observatii, data_origin, demo_seed_id) values
        (p_tenant_id, 'DEMO-CLI-' || v_code || '-01', 'Bistro Verde', '0740100200', 'bistro@example.ro', 'Suceava', 16, v_fixture_tag || ' Client demo', 'demo', v_seed_id),
        (p_tenant_id, 'DEMO-CLI-' || v_code || '-02', 'Magazin de proximitate', '0740300400', 'magazin@example.ro', 'Radauti', 14, v_fixture_tag || ' Client demo', 'demo', v_seed_id),
        (p_tenant_id, 'DEMO-CLI-' || v_code || '-03', 'Piata Centrala', '0740500600', 'piata@example.ro', 'Suceava', 13, v_fixture_tag || ' Client demo', 'demo', v_seed_id);
    else
      insert into public.clienti (tenant_id, id_client, nume_client, telefon, email, adresa, pret_negociat_lei_kg, observatii, data_origin, demo_seed_id) values
        (p_tenant_id, 'DEMO-CLI-' || v_code || '-01', 'Cofetaria Sweet', '0740100200', 'sweet@example.ro', 'Suceava', 25, v_fixture_tag || ' Client demo', 'demo', v_seed_id),
        (p_tenant_id, 'DEMO-CLI-' || v_code || '-02', 'Magazin Local', '0740300400', 'magazin@example.ro', 'Radauti', 23, v_fixture_tag || ' Client demo', 'demo', v_seed_id),
        (p_tenant_id, 'DEMO-CLI-' || v_code || '-03', 'Client Piata', '0740500600', 'piata@example.ro', 'Piata Centrala', 22, v_fixture_tag || ' Client demo', 'demo', v_seed_id);
    end if;

    select id into v_client_1
    from public.clienti
    where tenant_id = p_tenant_id and demo_seed_id = v_seed_id
    order by created_at asc limit 1;

    select id into v_client_2
    from public.clienti
    where tenant_id = p_tenant_id and demo_seed_id = v_seed_id
    order by created_at asc offset 1 limit 1;

    select id into v_client_3
    from public.clienti
    where tenant_id = p_tenant_id and demo_seed_id = v_seed_id
    order by created_at asc offset 2 limit 1;
  end if;

  if to_regclass('public.activitati_agricole') is not null then
    if v_demo_type = 'solar' then
      insert into public.activitati_agricole (
        tenant_id, id_activitate, data_aplicare, parcela_id, cultura_id, tip_activitate, produs_utilizat, doza, timp_pauza_zile, operator, observatii,
        data_origin, demo_seed_id
      ) values
        (p_tenant_id, 'DEMO-ACT-' || v_code || '-01', d_today - interval '2 day', v_parcela_1, v_cultura_1, 'copilit', 'lucrare manuala', '-', 0, 'Operator solar', v_fixture_tag || ' Activitate solar demo', 'demo', v_seed_id),
        (p_tenant_id, 'DEMO-ACT-' || v_code || '-02', d_today - interval '1 day', v_parcela_2, v_cultura_2, 'palisat', 'sfoara palisare', '-', 0, 'Operator solar', v_fixture_tag || ' Activitate solar demo', 'demo', v_seed_id),
        (p_tenant_id, 'DEMO-ACT-' || v_code || '-03', d_today, v_parcela_1, v_cultura_1, 'fertigare', 'NPK 20-20-20', '2 kg/1000l', 0, 'Operator solar', v_fixture_tag || ' Activitate solar demo', 'demo', v_seed_id);
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
        tenant_id, id_recoltare, data, parcela_id, cultura_id, culegator_id, kg_cal1, kg_cal2, cantitate_kg, pret_lei_pe_kg_snapshot, valoare_munca_lei, observatii,
        data_origin, demo_seed_id
      ) values
        (p_tenant_id, 'DEMO-REC-' || v_code || '-01', d_today, v_parcela_1, v_cultura_1, v_culegator_1, 62, 8, 70, 5.25, 367.5, v_fixture_tag || ' Recoltare solar demo', 'demo', v_seed_id),
        (p_tenant_id, 'DEMO-REC-' || v_code || '-02', d_today, v_parcela_2, v_cultura_2, v_culegator_2, 48, 6, 54, 5.00, 270, v_fixture_tag || ' Recoltare solar demo', 'demo', v_seed_id);
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
      insert into public.cheltuieli_diverse (tenant_id, id_cheltuiala, data, categorie, descriere, suma_lei, furnizor, data_origin, demo_seed_id) values
        (p_tenant_id, 'DEMO-CH-' || v_code || '-01', d_today, 'ingrasamant', v_fixture_tag || ' Nutrienti fertigare', 250, 'Agro Input', 'demo', v_seed_id),
        (p_tenant_id, 'DEMO-CH-' || v_code || '-02', d_today - interval '1 day', 'energie', v_fixture_tag || ' Consum ventilatie', 135, 'Furnizor Energie', 'demo', v_seed_id);
    else
      insert into public.cheltuieli_diverse (tenant_id, id_cheltuiala, data, categorie, descriere, suma_lei, furnizor, data_origin, demo_seed_id) values
        (p_tenant_id, 'DEMO-CH-' || v_code || '-01', d_today, 'motorina', v_fixture_tag || ' Alimentare utilaj', 120, 'Statie carburant', 'demo', v_seed_id),
        (p_tenant_id, 'DEMO-CH-' || v_code || '-02', d_today - interval '1 day', 'ambalaje', v_fixture_tag || ' Ladite recoltare', 85, 'Depozit ambalaje', 'demo', v_seed_id);
    end if;
  end if;

  if to_regclass('public.vanzari') is not null then
    if v_demo_type = 'solar' then
      insert into public.vanzari (tenant_id, id_vanzare, data, client_id, cantitate_kg, pret_lei_kg, status_plata, observatii_ladite, data_origin, demo_seed_id) values
        (p_tenant_id, 'DEMO-VNZ-' || v_code || '-01', d_today, v_client_1, 18, 16, 'incasat', v_fixture_tag || ' Vanzare solar demo', 'demo', v_seed_id),
        (p_tenant_id, 'DEMO-VNZ-' || v_code || '-02', d_today, v_client_2, 22, 14, 'incasat', v_fixture_tag || ' Vanzare solar demo', 'demo', v_seed_id),
        (p_tenant_id, 'DEMO-VNZ-' || v_code || '-03', d_today - interval '1 day', v_client_3, 16, 13, 'incasat', v_fixture_tag || ' Vanzare solar demo', 'demo', v_seed_id);
    else
      insert into public.vanzari (tenant_id, id_vanzare, data, client_id, cantitate_kg, pret_lei_kg, status_plata, observatii_ladite, data_origin, demo_seed_id) values
        (p_tenant_id, 'DEMO-VNZ-' || v_code || '-01', d_today, v_client_1, 12, 25, 'incasat', v_fixture_tag || ' Vanzare berries demo', 'demo', v_seed_id),
        (p_tenant_id, 'DEMO-VNZ-' || v_code || '-02', d_today, v_client_2, 8, 23, 'incasat', v_fixture_tag || ' Vanzare berries demo', 'demo', v_seed_id),
        (p_tenant_id, 'DEMO-VNZ-' || v_code || '-03', d_today - interval '1 day', v_client_3, 10, 22, 'incasat', v_fixture_tag || ' Vanzare berries demo', 'demo', v_seed_id);
    end if;
  end if;

  if to_regclass('public.comenzi') is not null then
    if v_demo_type = 'solar' then
      insert into public.comenzi (tenant_id, client_id, client_nume_manual, telefon, locatie_livrare, data_comanda, data_livrare, cantitate_kg, pret_per_kg, total, status, observatii, data_origin, demo_seed_id) values
        (p_tenant_id, v_client_1, null, '0740100200', 'Suceava', d_today, d_today, 15, 16, 240, 'programata', v_fixture_tag || ' Comanda solar demo', 'demo', v_seed_id),
        (p_tenant_id, v_client_2, null, '0740300400', 'Radauti', d_today, d_today + 1, 20, 14, 280, 'noua', v_fixture_tag || ' Comanda solar demo', 'demo', v_seed_id);
    else
      insert into public.comenzi (tenant_id, client_id, client_nume_manual, telefon, locatie_livrare, data_comanda, data_livrare, cantitate_kg, pret_per_kg, total, status, observatii, data_origin, demo_seed_id) values
        (p_tenant_id, v_client_1, null, '0740100200', 'Suceava', d_today, d_today, 10, 25, 250, 'programata', v_fixture_tag || ' Comanda berries demo', 'demo', v_seed_id),
        (p_tenant_id, v_client_2, null, '0740300400', 'Radauti', d_today, d_today + 1, 14, 23, 322, 'noua', v_fixture_tag || ' Comanda berries demo', 'demo', v_seed_id);
    end if;
  end if;

  if v_demo_type = 'solar' and to_regclass('public.solar_climate_logs') is not null then
    insert into public.solar_climate_logs (tenant_id, unitate_id, temperatura, umiditate, observatii, created_at, data_origin, demo_seed_id) values
      (p_tenant_id, v_parcela_1, 25.4, 67, v_fixture_tag || ' Climat solar 1', now() - interval '6 hour', 'demo', v_seed_id),
      (p_tenant_id, v_parcela_1, 27.1, 63, v_fixture_tag || ' Climat solar 1', now() - interval '2 hour', 'demo', v_seed_id),
      (p_tenant_id, v_parcela_2, 24.2, 71, v_fixture_tag || ' Climat solar 2', now() - interval '5 hour', 'demo', v_seed_id),
      (p_tenant_id, v_parcela_2, 26.3, 66, v_fixture_tag || ' Climat solar 2', now() - interval '1 hour', 'demo', v_seed_id);
  end if;

  if v_demo_type = 'solar' and to_regclass('public.culture_stage_logs') is not null then
    insert into public.culture_stage_logs (tenant_id, unitate_id, cultura_id, etapa, data, observatii, created_at, data_origin, demo_seed_id) values
      (p_tenant_id, v_parcela_1, v_cultura_1, 'plantare', d_today - 32, v_fixture_tag || ' Etapa solar', now() - interval '30 day', 'demo', v_seed_id),
      (p_tenant_id, v_parcela_1, v_cultura_1, 'primele flori', d_today - 14, v_fixture_tag || ' Etapa solar', now() - interval '12 day', 'demo', v_seed_id),
      (p_tenant_id, v_parcela_2, v_cultura_2, 'plantare', d_today - 24, v_fixture_tag || ' Etapa solar', now() - interval '22 day', 'demo', v_seed_id),
      (p_tenant_id, v_parcela_2, v_cultura_2, 'primele flori', d_today - 10, v_fixture_tag || ' Etapa solar', now() - interval '8 day', 'demo', v_seed_id);
  end if;

  update public.tenants
  set demo_seeded = true, demo_seed_id = v_seed_id, demo_seeded_at = now(), updated_at = now()
  where id = p_tenant_id;

  return jsonb_build_object(
    'status', 'seeded',
    'tenant_id', p_tenant_id,
    'demo_seed_id', v_seed_id,
    'demo_type', v_demo_type
  );
end
$$;

-- Suprascriere overload fără demo_type
create or replace function public.seed_demo_for_tenant(p_tenant_id uuid)
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
