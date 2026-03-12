-- Expand all varchar(10) identifier-like columns to varchar(50).
-- Targets columns in public base tables where name matches:
--   id_* OR *_id OR *_code
--
-- Handles dependent public views by:
-- 1) capturing definitions
-- 2) dropping views in reverse dependency order
-- 3) altering columns
-- 4) recreating views in dependency order

do $$
declare
  col_rec record;
  view_rec record;
begin
  create temp table if not exists _z_identifier_cols (
    table_schema text not null,
    table_name text not null,
    column_name text not null,
    primary key (table_schema, table_name, column_name)
  ) on commit drop;

  truncate table _z_identifier_cols;

  insert into _z_identifier_cols (table_schema, table_name, column_name)
  select
    c.table_schema,
    c.table_name,
    c.column_name
  from information_schema.columns c
  join information_schema.tables t
    on t.table_schema = c.table_schema
   and t.table_name = c.table_name
  where c.table_schema = 'public'
    and t.table_type = 'BASE TABLE'
    and c.data_type = 'character varying'
    and c.character_maximum_length = 10
    and (
      lower(c.column_name) like 'id\_%' escape '\'
      or lower(c.column_name) like '%\_id' escape '\'
      or lower(c.column_name) like '%\_code' escape '\'
    );

  if not exists (select 1 from _z_identifier_cols) then
    raise notice '[fix_identifier_length] No matching varchar(10) identifier columns found.';
    return;
  end if;

  create temp table if not exists _z_view_defs (
    view_schema text not null,
    view_name text not null,
    view_definition text not null,
    depth int not null,
    primary key (view_schema, view_name)
  ) on commit drop;

  truncate table _z_view_defs;

  with recursive direct_deps as (
    select distinct
      vn.nspname as view_schema,
      vc.relname as view_name,
      vc.oid as view_oid,
      1 as depth
    from _z_identifier_cols cols
    join pg_namespace tn
      on tn.nspname = cols.table_schema
    join pg_class tc
      on tc.relnamespace = tn.oid
     and tc.relname = cols.table_name
     and tc.relkind in ('r', 'p')
    join pg_depend d
      on d.refobjid = tc.oid
    join pg_rewrite rw
      on rw.oid = d.objid
    join pg_class vc
      on vc.oid = rw.ev_class
     and vc.relkind = 'v'
    join pg_namespace vn
      on vn.oid = vc.relnamespace
    where vn.nspname = 'public'
  ),
  all_deps as (
    select
      direct_deps.view_schema,
      direct_deps.view_name,
      direct_deps.view_oid,
      direct_deps.depth
    from direct_deps
    union all
    select
      vn2.nspname as view_schema,
      vc2.relname as view_name,
      vc2.oid as view_oid,
      all_deps.depth + 1 as depth
    from all_deps
    join pg_depend d2
      on d2.refobjid = all_deps.view_oid
    join pg_rewrite rw2
      on rw2.oid = d2.objid
    join pg_class vc2
      on vc2.oid = rw2.ev_class
     and vc2.relkind = 'v'
    join pg_namespace vn2
      on vn2.oid = vc2.relnamespace
    where vn2.nspname = 'public'
  ),
  dedup as (
    select
      view_schema,
      view_name,
      view_oid,
      max(depth) as depth
    from all_deps
    group by view_schema, view_name, view_oid
  )
  insert into _z_view_defs (view_schema, view_name, view_definition, depth)
  select
    d.view_schema,
    d.view_name,
    pg_get_viewdef(d.view_oid, true) as view_definition,
    d.depth
  from dedup d;

  for view_rec in
    select view_schema, view_name
    from _z_view_defs
    order by depth desc, view_schema, view_name
  loop
    execute format('drop view if exists %I.%I;', view_rec.view_schema, view_rec.view_name);
    raise notice '[fix_identifier_length] Dropped view %.%', view_rec.view_schema, view_rec.view_name;
  end loop;

  for col_rec in
    select table_schema, table_name, column_name
    from _z_identifier_cols
    order by table_schema, table_name, column_name
  loop
    execute format(
      'alter table %I.%I alter column %I type varchar(50);',
      col_rec.table_schema,
      col_rec.table_name,
      col_rec.column_name
    );
    raise notice '[fix_identifier_length] Altered %.%.% to varchar(50)',
      col_rec.table_schema, col_rec.table_name, col_rec.column_name;
  end loop;

  for view_rec in
    select view_schema, view_name, view_definition
    from _z_view_defs
    order by depth asc, view_schema, view_name
  loop
    execute format(
      'create view %I.%I as %s;',
      view_rec.view_schema,
      view_rec.view_name,
      view_rec.view_definition
    );
    raise notice '[fix_identifier_length] Recreated view %.%', view_rec.view_schema, view_rec.view_name;
  end loop;
end
$$;

notify pgrst, 'reload schema';
