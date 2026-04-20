-- Add 20 missing global crop catalog rows aligned with existing biological groups.
-- Idempotent: each insert only runs when the global cod is still absent.

insert into public.crops (name, unit_type, tenant_id, cod, grup_biologic)
select 'goji', 'camp', null, 'goji', 'arbusti_fara_cane'
where not exists (
  select 1 from public.crops where tenant_id is null and cod = 'goji'
);

insert into public.crops (name, unit_type, tenant_id, cod, grup_biologic)
select 'aronia', 'camp', null, 'aronia', 'arbusti_fara_cane'
where not exists (
  select 1 from public.crops where tenant_id is null and cod = 'aronia'
);

insert into public.crops (name, unit_type, tenant_id, cod, grup_biologic)
select 'catina', 'camp', null, 'catina', 'arbusti_fara_cane'
where not exists (
  select 1 from public.crops where tenant_id is null and cod = 'catina'
);

insert into public.crops (name, unit_type, tenant_id, cod, grup_biologic)
select 'alun', 'livada', null, 'alun', 'nucifere'
where not exists (
  select 1 from public.crops where tenant_id is null and cod = 'alun'
);

insert into public.crops (name, unit_type, tenant_id, cod, grup_biologic)
select 'fasole', 'solar', null, 'fasole', 'leguminoase'
where not exists (
  select 1 from public.crops where tenant_id is null and cod = 'fasole'
);

insert into public.crops (name, unit_type, tenant_id, cod, grup_biologic)
select 'mazare', 'solar', null, 'mazare', 'leguminoase'
where not exists (
  select 1 from public.crops where tenant_id is null and cod = 'mazare'
);

insert into public.crops (name, unit_type, tenant_id, cod, grup_biologic)
select 'varza', 'solar', null, 'varza', 'brassicaceae'
where not exists (
  select 1 from public.crops where tenant_id is null and cod = 'varza'
);

insert into public.crops (name, unit_type, tenant_id, cod, grup_biologic)
select 'broccoli', 'solar', null, 'broccoli', 'brassicaceae'
where not exists (
  select 1 from public.crops where tenant_id is null and cod = 'broccoli'
);

insert into public.crops (name, unit_type, tenant_id, cod, grup_biologic)
select 'conopida', 'solar', null, 'conopida', 'brassicaceae'
where not exists (
  select 1 from public.crops where tenant_id is null and cod = 'conopida'
);

insert into public.crops (name, unit_type, tenant_id, cod, grup_biologic)
select 'gulie', 'solar', null, 'gulie', 'brassicaceae'
where not exists (
  select 1 from public.crops where tenant_id is null and cod = 'gulie'
);

insert into public.crops (name, unit_type, tenant_id, cod, grup_biologic)
select 'ceapa', 'solar', null, 'ceapa', 'allium'
where not exists (
  select 1 from public.crops where tenant_id is null and cod = 'ceapa'
);

insert into public.crops (name, unit_type, tenant_id, cod, grup_biologic)
select 'usturoi', 'solar', null, 'usturoi', 'allium'
where not exists (
  select 1 from public.crops where tenant_id is null and cod = 'usturoi'
);

insert into public.crops (name, unit_type, tenant_id, cod, grup_biologic)
select 'praz', 'solar', null, 'praz', 'allium'
where not exists (
  select 1 from public.crops where tenant_id is null and cod = 'praz'
);

insert into public.crops (name, unit_type, tenant_id, cod, grup_biologic)
select 'morcovi', 'solar', null, 'morcov', 'radacinoase'
where not exists (
  select 1 from public.crops where tenant_id is null and cod = 'morcov'
);

insert into public.crops (name, unit_type, tenant_id, cod, grup_biologic)
select 'patrunjel', 'solar', null, 'patrunjel', 'radacinoase'
where not exists (
  select 1 from public.crops where tenant_id is null and cod = 'patrunjel'
);

insert into public.crops (name, unit_type, tenant_id, cod, grup_biologic)
select 'telina', 'solar', null, 'telina', 'radacinoase'
where not exists (
  select 1 from public.crops where tenant_id is null and cod = 'telina'
);

insert into public.crops (name, unit_type, tenant_id, cod, grup_biologic)
select 'sfecla', 'solar', null, 'sfecla', 'radacinoase'
where not exists (
  select 1 from public.crops where tenant_id is null and cod = 'sfecla'
);

insert into public.crops (name, unit_type, tenant_id, cod, grup_biologic)
select 'rucola', 'solar', null, 'rucola', 'frunzoase'
where not exists (
  select 1 from public.crops where tenant_id is null and cod = 'rucola'
);

insert into public.crops (name, unit_type, tenant_id, cod, grup_biologic)
select 'busuioc', 'solar', null, 'busuioc', 'frunzoase'
where not exists (
  select 1 from public.crops where tenant_id is null and cod = 'busuioc'
);

insert into public.crops (name, unit_type, tenant_id, cod, grup_biologic)
select 'cartofi', 'camp', null, 'cartof', 'solanacee'
where not exists (
  select 1 from public.crops where tenant_id is null and cod = 'cartof'
);
