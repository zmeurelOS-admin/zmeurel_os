-- Seed global crop varieties for predefined crops.
-- Insert only when crop_varieties exists and has no rows.

do $$
begin
  if to_regclass('public.crop_varieties') is null then
    raise notice 'Skipping global crop varieties seed: public.crop_varieties table does not exist.';
    return;
  end if;

  if to_regclass('public.crops') is null then
    raise notice 'Skipping global crop varieties seed: public.crops table does not exist.';
    return;
  end if;

  if exists (select 1 from public.crop_varieties limit 1) then
    raise notice 'Skipping global crop varieties seed: public.crop_varieties is not empty.';
    return;
  end if;

  insert into public.crop_varieties (crop_id, name, tenant_id)
  select c.id, v.variety_name, null::uuid
  from (
    values
      ('rosii', 'Siriana F1'),
      ('rosii', 'Prekos F1'),
      ('rosii', 'Pink Impression'),
      ('rosii', 'Inima de bou'),
      ('castraveti', 'Mirabelle F1'),
      ('castraveti', 'Corinto F1'),
      ('castraveti', 'Trilogy F1'),
      ('ardei', 'Kaptur F1'),
      ('ardei', 'Kapia'),
      ('ardei', 'California Wonder'),
      ('zmeura', 'Delniwa'),
      ('zmeura', 'Enrosadira'),
      ('zmeura', 'Maravilla'),
      ('zmeura', 'Polka')
  ) as v(crop_name, variety_name)
  join public.crops c
    on lower(c.name) = lower(v.crop_name)
   and c.tenant_id is null;
end
$$;
