alter table public.recoltari
  add column if not exists conflict_flag boolean default false;

alter table public.vanzari
  add column if not exists conflict_flag boolean default false;

alter table public.activitati_agricole
  add column if not exists conflict_flag boolean default false;

alter table public.cheltuieli_diverse
  add column if not exists conflict_flag boolean default false;

create or replace function public.upsert_with_idempotency(table_name text, payload jsonb)
returns jsonb
language plpgsql
security definer
as $$
declare
  result jsonb;
  assignments text;
  lww_condition text := '(coalesce(excluded.updated_at, now()) >= coalesce(t.updated_at, ''epoch''::timestamptz))';
  conflict_condition text := '(t.updated_at is not null and excluded.updated_at is not null and t.updated_at <> excluded.updated_at and abs(extract(epoch from (excluded.updated_at - t.updated_at))) < 5)';
begin
  if table_name not in ('recoltari', 'vanzari', 'activitati_agricole', 'cheltuieli_diverse') then
    raise exception 'Unsupported table: %', table_name;
  end if;

  select string_agg(
    case
      when c.column_name = 'conflict_flag' then format(
        '%1$I = case when %2$s then true when %3$s then false else t.%1$I end',
        c.column_name,
        conflict_condition,
        lww_condition
      )
      else format(
        '%1$I = case when %2$s then excluded.%1$I else t.%1$I end',
        c.column_name,
        lww_condition
      )
    end,
    ', '
  )
  into assignments
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = table_name
    and c.column_name not in ('id', 'created_at', 'created_by', 'client_sync_id');

  execute format(
    'with incoming as (
      select * from jsonb_populate_record(null::public.%1$I, $1)
    ),
    upserted as (
      insert into public.%1$I as t
      select * from incoming
      on conflict (client_sync_id)
      do update set %2$s
      returning t.*
    )
    select to_jsonb(upserted) from upserted',
    table_name,
    assignments
  )
  into result
  using payload;

  return result;
end;
$$;

