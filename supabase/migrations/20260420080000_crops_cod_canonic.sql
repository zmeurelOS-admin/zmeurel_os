-- Canonical crop code backfill for the existing 22 catalog rows.
-- Mapping applied (name -> cod):
-- zmeura -> zmeur
-- mure -> mur
-- afine -> afin
-- capsuni -> capsun
-- coacaze -> coacaz
-- agris -> agris
-- mar -> mar
-- par -> par
-- prun -> prun
-- cires -> cires
-- visin -> visin
-- cais -> cais
-- piersic -> piersic
-- nuc -> nuc
-- rosii -> rosie
-- castraveti -> castravete
-- ardei -> ardei
-- vinete -> vanata
-- salata -> salata
-- dovlecel -> dovlecel
-- spanac -> spanac
-- ridichi -> ridiche
--
-- The seed currently stores lowercase names, so the backfill matches on LOWER(BTRIM(name))
-- to remain idempotent and resilient to capitalization drift.

do $$
declare
  unmapped_names text[];
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'crops'
      and column_name = 'cod'
  ) then
    alter table public.crops add column cod text;
  end if;

  update public.crops
  set cod = case lower(btrim(name))
    when 'zmeura' then 'zmeur'
    when 'mure' then 'mur'
    when 'afine' then 'afin'
    when 'capsuni' then 'capsun'
    when 'coacaze' then 'coacaz'
    when 'agris' then 'agris'
    when 'mar' then 'mar'
    when 'par' then 'par'
    when 'prun' then 'prun'
    when 'cires' then 'cires'
    when 'visin' then 'visin'
    when 'cais' then 'cais'
    when 'piersic' then 'piersic'
    when 'nuc' then 'nuc'
    when 'rosii' then 'rosie'
    when 'castraveti' then 'castravete'
    when 'ardei' then 'ardei'
    when 'vinete' then 'vanata'
    when 'salata' then 'salata'
    when 'dovlecel' then 'dovlecel'
    when 'spanac' then 'spanac'
    when 'ridichi' then 'ridiche'
    else cod
  end
  where cod is null
     or cod is distinct from case lower(btrim(name))
       when 'zmeura' then 'zmeur'
       when 'mure' then 'mur'
       when 'afine' then 'afin'
       when 'capsuni' then 'capsun'
       when 'coacaze' then 'coacaz'
       when 'agris' then 'agris'
       when 'mar' then 'mar'
       when 'par' then 'par'
       when 'prun' then 'prun'
       when 'cires' then 'cires'
       when 'visin' then 'visin'
       when 'cais' then 'cais'
       when 'piersic' then 'piersic'
       when 'nuc' then 'nuc'
       when 'rosii' then 'rosie'
       when 'castraveti' then 'castravete'
       when 'ardei' then 'ardei'
       when 'vinete' then 'vanata'
       when 'salata' then 'salata'
       when 'dovlecel' then 'dovlecel'
       when 'spanac' then 'spanac'
       when 'ridichi' then 'ridiche'
       else cod
     end;

  select array_agg(distinct name order by name)
  into unmapped_names
  from public.crops
  where cod is null;

  if unmapped_names is not null then
    raise notice 'public.crops conține name fără mapare spre cod: %', unmapped_names;
  else
    alter table public.crops alter column cod set not null;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'crops'
      and column_name = 'tenant_id'
  ) then
    execute '
      create unique index if not exists crops_cod_global_unique
      on public.crops (cod)
      where tenant_id is null
    ';

    execute '
      create unique index if not exists crops_tenant_cod_unique
      on public.crops (tenant_id, cod)
      where tenant_id is not null
    ';
  else
    execute '
      create unique index if not exists crops_cod_unique
      on public.crops (cod)
    ';
  end if;
end
$$;
