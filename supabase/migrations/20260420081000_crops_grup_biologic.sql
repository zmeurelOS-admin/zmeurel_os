-- Extinde `public.crops` cu `grup_biologic`, mapat pe `cod` canonic.
-- Mapare fixată în Faza 2:
-- zmeur -> rubus
-- mur -> rubus
-- afin -> arbusti_fara_cane
-- coacaz -> arbusti_fara_cane
-- agris -> arbusti_fara_cane
-- capsun -> arbusti_fara_cane
-- mar -> pomi_samanoase
-- par -> pomi_samanoase
-- prun -> pomi_samburoase
-- cires -> pomi_samburoase
-- visin -> pomi_samburoase
-- cais -> pomi_samburoase
-- piersic -> pomi_samburoase
-- nuc -> nucifere
-- rosie -> solanacee
-- ardei -> solanacee
-- vanata -> solanacee
-- castravete -> cucurbitacee
-- dovlecel -> cucurbitacee
-- salata -> frunzoase
-- spanac -> frunzoase
-- ridiche -> radacinoase

alter table public.crops
  add column if not exists grup_biologic text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'crops_grup_biologic_check'
      and conrelid = 'public.crops'::regclass
  ) then
    alter table public.crops
      add constraint crops_grup_biologic_check
      check (
        grup_biologic is null
        or grup_biologic in (
          'rubus',
          'arbusti_fara_cane',
          'pomi_samanoase',
          'pomi_samburoase',
          'nucifere',
          'solanacee',
          'cucurbitacee',
          'brassicaceae',
          'allium',
          'leguminoase',
          'radacinoase',
          'frunzoase'
        )
      );
  end if;
end
$$;

update public.crops
set grup_biologic = case cod
  when 'zmeur' then 'rubus'
  when 'mur' then 'rubus'
  when 'afin' then 'arbusti_fara_cane'
  when 'coacaz' then 'arbusti_fara_cane'
  when 'agris' then 'arbusti_fara_cane'
  when 'capsun' then 'arbusti_fara_cane'
  when 'mar' then 'pomi_samanoase'
  when 'par' then 'pomi_samanoase'
  when 'prun' then 'pomi_samburoase'
  when 'cires' then 'pomi_samburoase'
  when 'visin' then 'pomi_samburoase'
  when 'cais' then 'pomi_samburoase'
  when 'piersic' then 'pomi_samburoase'
  when 'nuc' then 'nucifere'
  when 'rosie' then 'solanacee'
  when 'ardei' then 'solanacee'
  when 'vanata' then 'solanacee'
  when 'castravete' then 'cucurbitacee'
  when 'dovlecel' then 'cucurbitacee'
  when 'salata' then 'frunzoase'
  when 'spanac' then 'frunzoase'
  when 'ridiche' then 'radacinoase'
  else grup_biologic
end
where cod is not null;

do $$
declare
  remaining_names text;
begin
  select string_agg(name, ', ' order by name)
  into remaining_names
  from public.crops
  where grup_biologic is null;

  if remaining_names is not null then
    raise notice 'crops rows still missing grup_biologic: %', remaining_names;
  else
    alter table public.crops
      alter column grup_biologic set not null;
  end if;
end
$$;
