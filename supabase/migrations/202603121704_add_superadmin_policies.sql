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
      'create policy %I on public.%I for all to authenticated using (exists (select 1 from public.profiles where id = auth.uid() and is_superadmin = true))',
      table_name || '_superadmin',
      table_name
    );
  end loop;
end
$$;

notify pgrst, 'reload schema';
