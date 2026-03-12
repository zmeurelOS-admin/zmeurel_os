do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any (
        array[
          'parcele',
          'recoltari',
          'vanzari',
          'activitati_agricole',
          'clienti',
          'cheltuieli_diverse',
          'investitii',
          'culegatori',
          'miscari_stoc',
          'vanzari_butasi',
          'comenzi',
          'solar_climate_logs',
          'culture_stage_logs'
        ]
      )
      and (
        coalesce(qual, '') ilike '%owner_user_id = auth.uid()%'
        or coalesce(with_check, '') ilike '%owner_user_id = auth.uid()%'
        or coalesce(qual, '') ilike '%from tenants%'
        or coalesce(with_check, '') ilike '%from tenants%'
        or coalesce(qual, '') ilike '%select tenants.id%'
        or coalesce(with_check, '') ilike '%select tenants.id%'
      )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      r.policyname,
      r.schemaname,
      r.tablename
    );
  end loop;
end
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'parcele',
    'recoltari',
    'vanzari',
    'activitati_agricole',
    'clienti',
    'cheltuieli_diverse',
    'investitii',
    'culegatori',
    'miscari_stoc',
    'vanzari_butasi',
    'comenzi',
    'solar_climate_logs',
    'culture_stage_logs'
  ]
  loop
    execute format(
      'alter table public.%I enable row level security',
      table_name
    );

    execute format(
      'drop policy if exists %I on public.%I',
      table_name || '_select',
      table_name
    );
    execute format(
      'drop policy if exists %I on public.%I',
      table_name || '_insert',
      table_name
    );
    execute format(
      'drop policy if exists %I on public.%I',
      table_name || '_update',
      table_name
    );
    execute format(
      'drop policy if exists %I on public.%I',
      table_name || '_delete',
      table_name
    );
    execute format(
      'drop policy if exists %I on public.%I',
      table_name || '_tenant_select',
      table_name
    );
    execute format(
      'drop policy if exists %I on public.%I',
      table_name || '_tenant_insert',
      table_name
    );
    execute format(
      'drop policy if exists %I on public.%I',
      table_name || '_tenant_update',
      table_name
    );
    execute format(
      'drop policy if exists %I on public.%I',
      table_name || '_tenant_delete',
      table_name
    );

    execute format(
      'create policy %I on public.%I for select to authenticated using (tenant_id = public.current_tenant_id())',
      table_name || '_select',
      table_name
    );

    execute format(
      'create policy %I on public.%I for insert to authenticated with check (tenant_id = public.current_tenant_id())',
      table_name || '_insert',
      table_name
    );

    execute format(
      'create policy %I on public.%I for update to authenticated using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id())',
      table_name || '_update',
      table_name
    );

    execute format(
      'create policy %I on public.%I for delete to authenticated using (tenant_id = public.current_tenant_id())',
      table_name || '_delete',
      table_name
    );
  end loop;
end
$$;

notify pgrst, 'reload schema';
