-- Refresh stale views so they expose newer base-table columns such as cultura_id.
-- These definitions are aligned to the current local schema. If a linked environment
-- has diverged, compare with:
--   SELECT pg_get_viewdef('public.activitati_extended'::regclass, true);
--   SELECT pg_get_viewdef('public.parcele_extended'::regclass, true);

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
  end as status_pauza,
  a.client_sync_id,
  a.conflict_flag,
  a.created_by,
  a.updated_by,
  a.sync_status,
  a.data_origin,
  a.demo_seed_id,
  a.cultura_id
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
  end as varsta_ani,
  p.tip_unitate,
  p.cultura,
  p.soi,
  p.stadiu,
  p.data_plantarii,
  p.nr_randuri,
  p.distanta_intre_randuri,
  p.sistem_irigare,
  p.created_by,
  p.updated_by,
  p.data_origin,
  p.demo_seed_id
from public.parcele p;

notify pgrst, 'reload schema';
