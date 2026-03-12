do $$
declare
  tbl text;
  tenant_check text := 'tenant_id = (
    select id
    from public.tenants
    where owner_user_id = auth.uid()
    limit 1
  )';
begin
  foreach tbl in array array[
    'recoltari',
    'vanzari',
    'activitati_agricole',
    'clienti',
    'parcele',
    'cheltuieli_diverse'
  ] loop
    if to_regclass('public.' || tbl) is null then
      continue;
    end if;

    execute format('drop policy if exists %I on public.%I', tbl || '_tenant_select', tbl);
    execute format(
      'create policy %I on public.%I for select using (%s)',
      tbl || '_tenant_select',
      tbl,
      tenant_check
    );

    execute format('drop policy if exists %I on public.%I', tbl || '_tenant_insert', tbl);
    execute format(
      'create policy %I on public.%I for insert with check (%s)',
      tbl || '_tenant_insert',
      tbl,
      tenant_check
    );

    execute format('drop policy if exists %I on public.%I', tbl || '_tenant_update', tbl);
    execute format(
      'create policy %I on public.%I for update using (%s) with check (%s)',
      tbl || '_tenant_update',
      tbl,
      tenant_check,
      tenant_check
    );
  end loop;

  foreach tbl in array array[
    'recoltari',
    'vanzari',
    'activitati_agricole',
    'cheltuieli_diverse'
  ] loop
    if to_regclass('public.' || tbl) is null then
      continue;
    end if;

    execute format('drop policy if exists %I on public.%I', tbl || '_owner_update', tbl);
    execute format(
      'create policy %I on public.%I for update using (%s and coalesce(created_by, auth.uid()) = auth.uid()) with check (%s and coalesce(created_by, auth.uid()) = auth.uid())',
      tbl || '_owner_update',
      tbl,
      tenant_check,
      tenant_check
    );
  end loop;
end
$$;

drop policy if exists alert_dismissals_select on public.alert_dismissals;
create policy alert_dismissals_select
on public.alert_dismissals
for select
using (
  user_id = auth.uid()
  and tenant_id = (
    select t.id
    from public.tenants t
    where t.owner_user_id = auth.uid()
    limit 1
  )
);

drop policy if exists alert_dismissals_insert on public.alert_dismissals;
create policy alert_dismissals_insert
on public.alert_dismissals
for insert
with check (
  user_id = auth.uid()
  and tenant_id = (
    select t.id
    from public.tenants t
    where t.owner_user_id = auth.uid()
    limit 1
  )
);

drop policy if exists alert_dismissals_delete on public.alert_dismissals;
create policy alert_dismissals_delete
on public.alert_dismissals
for delete
using (
  user_id = auth.uid()
  and tenant_id = (
    select t.id
    from public.tenants t
    where t.owner_user_id = auth.uid()
    limit 1
  )
);

notify pgrst, 'reload schema';
