drop view if exists public.activitati_extra_extended;

alter table public.activitati_extra_season
alter column id_activitate type varchar(50);

create or replace view public.activitati_extra_extended as
 select a.id,
    a.tenant_id,
    a.id_activitate,
    a.data,
    a.parcela_id,
    a.tip_activitate,
    a.descriere,
    a.cost_lei,
    a.manopera_ore,
    a.manopera_persoane,
    a.observatii,
    a.created_at,
    a.updated_at,
    p.nume_parcela,
    p.soi_plantat,
    p.suprafata_m2,
        case
            when p.suprafata_m2 > 0::numeric then a.cost_lei / p.suprafata_m2
            else 0::numeric
        end as cost_lei_per_m2,
        case
            when a.manopera_ore > 0::numeric then a.cost_lei / a.manopera_ore
            else 0::numeric
        end as cost_lei_per_ora
   from activitati_extra_season a
     left join parcele p on a.parcela_id = p.id;
