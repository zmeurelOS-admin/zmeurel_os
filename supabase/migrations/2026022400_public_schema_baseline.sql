-- Baseline migration to make core public schema reproducible.
-- This captures objects that exist in production but were created
-- outside the tracked migration history.

create extension if not exists pgcrypto;

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  nume_ferma character varying not null,
  owner_user_id uuid,
  plan character varying default 'freemium',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  demo_seeded boolean not null default false,
  demo_seed_id uuid,
  demo_seeded_at timestamptz
);

create table if not exists public.profiles (
  id uuid primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_superadmin boolean not null default false
);

create table if not exists public.parcele (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  id_parcela character varying not null,
  nume_parcela character varying not null,
  suprafata_m2 numeric not null,
  tip_fruct character varying,
  soi_plantat character varying,
  an_plantare integer not null,
  nr_plante integer,
  status character varying,
  gps_lat numeric,
  gps_lng numeric,
  observatii text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  data_origin text,
  demo_seed_id uuid,
  tip_unitate text not null default 'camp',
  cultura text,
  soi text,
  nr_randuri integer,
  distanta_intre_randuri numeric,
  sistem_irigare text,
  data_plantarii date
);

create table if not exists public.activitati_agricole (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  id_activitate character varying not null,
  data_aplicare timestamptz not null,
  parcela_id uuid,
  tip_activitate character varying,
  produs_utilizat character varying,
  doza character varying,
  timp_pauza_zile integer,
  operator character varying,
  observatii text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  client_sync_id uuid not null default gen_random_uuid(),
  sync_status text default 'synced',
  conflict_flag boolean default false,
  data_origin text,
  demo_seed_id uuid
);

create table if not exists public.recoltari (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  id_recoltare character varying not null,
  data date not null,
  culegator_id uuid,
  parcela_id uuid,
  observatii text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cantitate_kg numeric not null default 0,
  kg_cal1 numeric not null default 0,
  kg_cal2 numeric not null default 0,
  pret_lei_pe_kg_snapshot numeric not null default 0,
  valoare_munca_lei numeric not null default 0,
  created_by uuid,
  updated_by uuid,
  client_sync_id uuid not null default gen_random_uuid(),
  sync_status text default 'synced',
  conflict_flag boolean default false,
  data_origin text,
  demo_seed_id uuid
);

create table if not exists public.vanzari (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  id_vanzare character varying not null,
  data date not null,
  client_id uuid,
  cantitate_kg numeric not null,
  pret_lei_kg numeric not null,
  status_plata character varying,
  observatii_ladite text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  client_sync_id uuid not null default gen_random_uuid(),
  sync_status text default 'synced',
  conflict_flag boolean default false,
  data_origin text,
  demo_seed_id uuid,
  comanda_id uuid
);

create table if not exists public.clienti (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  id_client character varying not null,
  nume_client character varying not null,
  telefon character varying,
  email character varying,
  adresa text,
  pret_negociat_lei_kg numeric,
  observatii text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  google_resource_name text,
  google_etag text,
  data_origin text,
  demo_seed_id uuid
);

create table if not exists public.cheltuieli_diverse (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  id_cheltuiala character varying not null,
  data date not null,
  categorie character varying,
  descriere text,
  suma_lei numeric not null,
  furnizor character varying,
  document_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  client_sync_id uuid not null default gen_random_uuid(),
  sync_status text default 'synced',
  conflict_flag boolean default false,
  data_origin text,
  demo_seed_id uuid,
  is_auto_generated boolean default false
);

create table if not exists public.culegatori (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  id_culegator character varying not null,
  nume_prenume character varying not null,
  telefon character varying,
  tip_angajare character varying,
  tarif_lei_kg numeric,
  data_angajare date,
  status_activ boolean,
  observatii text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  data_origin text,
  demo_seed_id uuid
);

create table if not exists public.investitii (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  id_investitie character varying not null,
  data date not null,
  parcela_id uuid,
  categorie character varying,
  furnizor character varying,
  descriere text,
  suma_lei numeric not null,
  document_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  data_origin text,
  demo_seed_id uuid
);

create table if not exists public.vanzari_butasi (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  id_vanzare_butasi character varying not null,
  data date not null,
  client_id uuid,
  parcela_sursa_id uuid,
  tip_fruct character varying,
  soi_butasi character varying,
  cantitate_butasi integer not null,
  pret_unitar_lei numeric not null,
  observatii text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  data_comanda date not null default current_date,
  data_livrare_estimata date,
  status text not null default 'noua',
  adresa_livrare text,
  avans_suma numeric not null default 0,
  avans_data date,
  total_lei numeric not null default 0,
  data_origin text,
  demo_seed_id uuid
);

create table if not exists public.crops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit_type text not null,
  tenant_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.nomenclatoare (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  tip character varying not null,
  valoare character varying not null,
  descriere text,
  nivel character varying,
  activ boolean,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.activitati_extra_season (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  id_activitate character varying not null,
  data date not null,
  parcela_id uuid,
  tip_activitate character varying not null,
  descriere text,
  cost_lei numeric,
  manopera_ore numeric,
  manopera_persoane integer,
  observatii text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create or replace view public.activitati_extended
with (security_invoker = true)
as
select
  a.id,
  a.tenant_id,
  a.id_activitate,
  a.data_aplicare,
  a.parcela_id,
  a.tip_activitate,
  a.produs_utilizat,
  a.doza,
  a.timp_pauza_zile,
  a.operator,
  a.observatii,
  a.created_at,
  a.updated_at,
  case
    when a.timp_pauza_zile is null then null
    else (a.data_aplicare::date + a.timp_pauza_zile)
  end as data_recoltare_permisa,
  case
    when a.timp_pauza_zile is null then 'fara_pauza'::text
    when current_date <= (a.data_aplicare::date + a.timp_pauza_zile) then 'in_pauza'::text
    else 'expirata'::text
  end as status_pauza
from public.activitati_agricole a;

create or replace view public.parcele_extended
with (security_invoker = true)
as
select
  p.id,
  p.tenant_id,
  p.id_parcela,
  p.nume_parcela,
  p.suprafata_m2,
  p.tip_fruct,
  p.soi_plantat,
  p.an_plantare,
  p.nr_plante,
  p.status,
  p.gps_lat,
  p.gps_lng,
  p.observatii,
  p.created_at,
  p.updated_at,
  case
    when p.suprafata_m2 > 0 and p.nr_plante is not null
      then round((p.nr_plante::numeric / p.suprafata_m2::numeric), 4)
    else null
  end as densitate_plante_m2,
  case
    when p.an_plantare is null then null
    else extract(year from age(current_date, make_date(p.an_plantare, 1, 1)))::numeric
  end as varsta_ani
from public.parcele p;

create or replace view public.vanzari_extended
with (security_invoker = true)
as
select v.*
from public.vanzari v;

