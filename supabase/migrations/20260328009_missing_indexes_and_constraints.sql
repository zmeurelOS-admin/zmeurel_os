-- Add missing indexes and harden enum-like fields with compatibility-aware checks.
-- This migration intentionally does not update user data. For live environments,
-- each CHECK constraint is built after inspecting current distinct values so that
-- existing non-null variants remain accepted at apply time.

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'recoltari'
      and indexdef ilike 'create index % on public.recoltari using btree (culegator_id)%'
  ) then
    create index recoltari_culegator_id_idx on public.recoltari(culegator_id);
  end if;
end;
$$;

create index if not exists vanzari_comanda_id_idx on public.vanzari(comanda_id);

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'investitii'
      and indexdef ilike 'create index % on public.investitii using btree (tenant_id)%'
  ) then
    create index investitii_tenant_id_idx on public.investitii(tenant_id);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'investitii'
      and indexdef ilike 'create index % on public.investitii using btree (parcela_id)%'
  ) then
    create index investitii_parcela_id_idx on public.investitii(parcela_id);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'vanzari_butasi'
      and indexdef ilike 'create index % on public.vanzari_butasi using btree (tenant_id)%'
  ) then
    create index vanzari_butasi_tenant_id_idx on public.vanzari_butasi(tenant_id);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'activitati_agricole'
      and indexdef ilike 'create index % on public.activitati_agricole using btree (parcela_id)%'
  ) then
    create index activitati_agricole_parcela_id_idx on public.activitati_agricole(parcela_id);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'analytics_events'
      and (
        indexdef ilike 'create index % on public.analytics_events using btree (tenant_id, created_at)%'
        or indexdef ilike 'create index % on public.analytics_events using btree (tenant_id, created_at desc)%'
      )
  ) then
    create index analytics_events_tenant_created_idx on public.analytics_events(tenant_id, created_at desc);
  end if;
end;
$$;

alter table public.vanzari
  drop constraint if exists vanzari_status_plata_check;

do $$
declare
  v_allowed text[];
  v_allowed_sql text;
begin
  select array_agg(distinct value order by value)
  into v_allowed
  from (
    select unnest(array[
      'platit',
      'avans',
      'restanta',
      'neplatit'
    ]::text[]) as value
    union
    select lower(btrim(status_plata))
    from public.vanzari
    where status_plata is not null
      and btrim(status_plata) <> ''
  ) valueset;

  select string_agg(quote_literal(value), ', ' order by value)
  into v_allowed_sql
  from unnest(v_allowed) as value;

  execute format(
    'alter table public.vanzari add constraint vanzari_status_plata_check check (status_plata is null or lower(btrim(status_plata)) = any (array[%s]::text[]))',
    v_allowed_sql
  );
end;
$$;

alter table public.culturi
  drop constraint if exists culturi_stadiu_check;

do $$
declare
  v_allowed text[];
  v_allowed_sql text;
begin
  select array_agg(distinct value order by value)
  into v_allowed
  from (
    select unnest(array[
      'plantare',
      'crestere',
      'inflorire',
      'fructificare',
      'recoltare',
      'repaus',
      'cules',
      'incoltit',
      'vegetativ',
      'inflorit',
      'seceta',
      'daunator',
      'altele'
    ]::text[]) as value
    union
    select lower(btrim(stadiu))
    from public.culturi
    where stadiu is not null
      and btrim(stadiu) <> ''
  ) valueset;

  select string_agg(quote_literal(value), ', ' order by value)
  into v_allowed_sql
  from unnest(v_allowed) as value;

  execute format(
    'alter table public.culturi add constraint culturi_stadiu_check check (stadiu is null or lower(btrim(stadiu)) = any (array[%s]::text[]))',
    v_allowed_sql
  );
end;
$$;

alter table public.cheltuieli_diverse
  drop constraint if exists cheltuieli_metoda_plata_check;

do $$
declare
  v_allowed text[];
  v_allowed_sql text;
begin
  select array_agg(distinct value order by value)
  into v_allowed
  from (
    select unnest(array[
      'cash',
      'card',
      'transfer',
      'alta'
    ]::text[]) as value
    union
    select lower(btrim(metoda_plata))
    from public.cheltuieli_diverse
    where metoda_plata is not null
      and btrim(metoda_plata) <> ''
  ) valueset;

  select string_agg(quote_literal(value), ', ' order by value)
  into v_allowed_sql
  from unnest(v_allowed) as value;

  execute format(
    'alter table public.cheltuieli_diverse add constraint cheltuieli_metoda_plata_check check (metoda_plata is null or lower(btrim(metoda_plata)) = any (array[%s]::text[]))',
    v_allowed_sql
  );
end;
$$;

notify pgrst, 'reload schema';
