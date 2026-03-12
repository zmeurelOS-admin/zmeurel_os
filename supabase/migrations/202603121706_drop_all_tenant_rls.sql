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

notify pgrst, 'reload schema';
