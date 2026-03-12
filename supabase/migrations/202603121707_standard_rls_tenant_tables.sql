do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'parcele',
    'activitati_agricole',
    'recoltari',
    'vanzari',
    'clienti',
    'cheltuieli_diverse',
    'investitii',
    'culegatori',
    'miscari_stoc',
    'vanzari_butasi',
    'vanzari_butasi_items',
    'comenzi',
    'solar_climate_logs',
    'culture_stage_logs',
    'crop_varieties',
    'nomenclatoare',
    'activitati_extra_season'
  ]
  loop
    execute format(
      'alter table public.%I enable row level security',
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
