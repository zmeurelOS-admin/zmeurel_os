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
  foreach tbl in array array['culegatori', 'investitii', 'vanzari_butasi'] loop
    if to_regclass('public.' || tbl) is null then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', tbl);

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

    execute format('drop policy if exists %I on public.%I', tbl || '_tenant_delete', tbl);
    execute format(
      'create policy %I on public.%I for delete using (%s)',
      tbl || '_tenant_delete',
      tbl,
      tenant_check
    );
  end loop;

  foreach tbl in array array[
    'parcele',
    'recoltari',
    'activitati_agricole',
    'vanzari',
    'clienti',
    'cheltuieli_diverse'
  ] loop
    if to_regclass('public.' || tbl) is null then
      continue;
    end if;

    execute format('drop policy if exists %I on public.%I', tbl || '_tenant_delete', tbl);
    execute format(
      'create policy %I on public.%I for delete using (%s)',
      tbl || '_tenant_delete',
      tbl,
      tenant_check
    );
  end loop;
end
$$;

notify pgrst, 'reload schema';
