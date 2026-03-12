-- Seed global crops catalog for all tenants.
-- Insert only when crops table exists and is empty.

do $$
begin
  if to_regclass('public.crops') is null then
    raise notice 'Skipping global crops seed: public.crops table does not exist.';
    return;
  end if;

  if exists (select 1 from public.crops limit 1) then
    raise notice 'Skipping global crops seed: public.crops is not empty.';
    return;
  end if;

  insert into public.crops (name, unit_type, tenant_id)
  values
    -- solar
    ('rosii', 'solar', null),
    ('castraveti', 'solar', null),
    ('ardei', 'solar', null),
    ('vinete', 'solar', null),
    ('salata', 'solar', null),
    ('dovlecel', 'solar', null),
    ('spanac', 'solar', null),
    ('ridichi', 'solar', null),
    -- camp
    ('zmeura', 'camp', null),
    ('mure', 'camp', null),
    ('afine', 'camp', null),
    ('capsuni', 'camp', null),
    ('coacaze', 'camp', null),
    ('agris', 'camp', null),
    -- livada
    ('mar', 'livada', null),
    ('par', 'livada', null),
    ('prun', 'livada', null),
    ('cires', 'livada', null),
    ('visin', 'livada', null),
    ('cais', 'livada', null),
    ('piersic', 'livada', null),
    ('nuc', 'livada', null);
end
$$;
