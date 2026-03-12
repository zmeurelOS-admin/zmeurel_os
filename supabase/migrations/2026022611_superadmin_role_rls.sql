-- Superadmin architecture: role separated from plan.
-- Plan remains in public.tenants.plan, while authorization bypass lives in public.profiles.is_superadmin.

do $$
begin
  if to_regclass('public.profiles') is null then
    raise exception 'public.profiles table is required for superadmin role';
  end if;
end
$$;

alter table public.profiles
  add column if not exists is_superadmin boolean not null default false;

create index if not exists profiles_is_superadmin_idx
  on public.profiles (is_superadmin)
  where is_superadmin = true;

create or replace function public.is_superadmin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = check_user_id
      and coalesce(p.is_superadmin, false) = true
  );
$$;

grant execute on function public.is_superadmin(uuid) to authenticated;
grant execute on function public.is_superadmin(uuid) to service_role;

update public.profiles
set is_superadmin = true
where id = (
  select id
  from auth.users
  where email = 'popa.andrei.sv@gmail.com'
  limit 1
);

do $$
declare
  table_row record;
begin
  for table_row in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema
      and t.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'tenant_id'
      and t.table_type = 'BASE TABLE'
    group by c.table_name
  loop
    execute format('alter table public.%I enable row level security', table_row.table_name);

    execute format('drop policy if exists %I on public.%I', table_row.table_name || '_superadmin_select', table_row.table_name);
    execute format(
      'create policy %I on public.%I for select using (public.is_superadmin())',
      table_row.table_name || '_superadmin_select',
      table_row.table_name
    );

    execute format('drop policy if exists %I on public.%I', table_row.table_name || '_superadmin_insert', table_row.table_name);
    execute format(
      'create policy %I on public.%I for insert with check (public.is_superadmin())',
      table_row.table_name || '_superadmin_insert',
      table_row.table_name
    );

    execute format('drop policy if exists %I on public.%I', table_row.table_name || '_superadmin_update', table_row.table_name);
    execute format(
      'create policy %I on public.%I for update using (public.is_superadmin()) with check (public.is_superadmin())',
      table_row.table_name || '_superadmin_update',
      table_row.table_name
    );

    execute format('drop policy if exists %I on public.%I', table_row.table_name || '_superadmin_delete', table_row.table_name);
    execute format(
      'create policy %I on public.%I for delete using (public.is_superadmin())',
      table_row.table_name || '_superadmin_delete',
      table_row.table_name
    );
  end loop;
end
$$;

notify pgrst, 'reload schema';
