-- Update core FK delete behavior for tenant cleanup and nullable business links.
-- IMPORTANT:
-- 1. These changes affect future deletes. Review carefully before applying.
-- 2. This migration does NOT delete data by itself.
-- 3. It performs preflight orphan checks and aborts if inconsistent data is found.
--
-- Recommended manual verification on the target environment before apply:
--   select count(*) from public.parcele p left join public.tenants t on t.id = p.tenant_id where t.id is null;
--   select count(*) from public.activitati_agricole a left join public.tenants t on t.id = a.tenant_id where a.tenant_id is not null and t.id is null;
--   select count(*) from public.recoltari r left join public.tenants t on t.id = r.tenant_id where t.id is null;
--   select count(*) from public.clienti c left join public.tenants t on t.id = c.tenant_id where t.id is null;
--   select count(*) from public.cheltuieli_diverse c left join public.tenants t on t.id = c.tenant_id where t.id is null;
--   select count(*) from public.culegatori c left join public.tenants t on t.id = c.tenant_id where c.tenant_id is not null and t.id is null;
--   select count(*) from public.investitii i left join public.tenants t on t.id = i.tenant_id where t.id is null;
--   select count(*) from public.profiles p left join public.tenants t on t.id = p.tenant_id where p.tenant_id is not null and t.id is null;
--   select count(*) from public.activitati_agricole a left join public.parcele p on p.id = a.parcela_id where a.parcela_id is not null and p.id is null;
--   select count(*) from public.recoltari r left join public.culegatori c on c.id = r.culegator_id where r.culegator_id is not null and c.id is null;
--   select count(*) from public.vanzari v left join public.clienti c on c.id = v.client_id where v.client_id is not null and c.id is null;

do $$
begin
  if exists (
    select 1
    from public.parcele p
    left join public.tenants t on t.id = p.tenant_id
    where t.id is null
  ) then
    raise exception 'fk_precheck_failed'
      using hint = 'Există parcele cu tenant_id orfan. Migrarea FK cascade a fost oprită.';
  end if;

  if exists (
    select 1
    from public.activitati_agricole a
    left join public.tenants t on t.id = a.tenant_id
    where a.tenant_id is not null
      and t.id is null
  ) then
    raise exception 'fk_precheck_failed'
      using hint = 'Există activități agricole cu tenant_id orfan. Migrarea FK cascade a fost oprită.';
  end if;

  if exists (
    select 1
    from public.recoltari r
    left join public.tenants t on t.id = r.tenant_id
    where t.id is null
  ) then
    raise exception 'fk_precheck_failed'
      using hint = 'Există recoltări cu tenant_id orfan. Migrarea FK cascade a fost oprită.';
  end if;

  if exists (
    select 1
    from public.clienti c
    left join public.tenants t on t.id = c.tenant_id
    where t.id is null
  ) then
    raise exception 'fk_precheck_failed'
      using hint = 'Există clienți cu tenant_id orfan. Migrarea FK cascade a fost oprită.';
  end if;

  if exists (
    select 1
    from public.cheltuieli_diverse c
    left join public.tenants t on t.id = c.tenant_id
    where t.id is null
  ) then
    raise exception 'fk_precheck_failed'
      using hint = 'Există cheltuieli cu tenant_id orfan. Migrarea FK cascade a fost oprită.';
  end if;

  if exists (
    select 1
    from public.culegatori c
    left join public.tenants t on t.id = c.tenant_id
    where c.tenant_id is not null
      and t.id is null
  ) then
    raise exception 'fk_precheck_failed'
      using hint = 'Există culegători cu tenant_id orfan. Migrarea FK cascade a fost oprită.';
  end if;

  if exists (
    select 1
    from public.investitii i
    left join public.tenants t on t.id = i.tenant_id
    where t.id is null
  ) then
    raise exception 'fk_precheck_failed'
      using hint = 'Există investiții cu tenant_id orfan. Migrarea FK cascade a fost oprită.';
  end if;

  if exists (
    select 1
    from public.profiles p
    left join public.tenants t on t.id = p.tenant_id
    where p.tenant_id is not null
      and t.id is null
  ) then
    raise exception 'fk_precheck_failed'
      using hint = 'Există profiles cu tenant_id orfan. Migrarea FK cascade a fost oprită.';
  end if;

  if exists (
    select 1
    from public.activitati_agricole a
    left join public.parcele p on p.id = a.parcela_id
    where a.parcela_id is not null
      and p.id is null
  ) then
    raise exception 'fk_precheck_failed'
      using hint = 'Există activități agricole cu parcela_id orfan. Migrarea FK cascade a fost oprită.';
  end if;

  if exists (
    select 1
    from public.recoltari r
    left join public.culegatori c on c.id = r.culegator_id
    where r.culegator_id is not null
      and c.id is null
  ) then
    raise exception 'fk_precheck_failed'
      using hint = 'Există recoltări cu culegator_id orfan. Migrarea FK cascade a fost oprită.';
  end if;

  if exists (
    select 1
    from public.vanzari v
    left join public.clienti c on c.id = v.client_id
    where v.client_id is not null
      and c.id is null
  ) then
    raise exception 'fk_precheck_failed'
      using hint = 'Există vânzări cu client_id orfan. Migrarea FK cascade a fost oprită.';
  end if;
end
$$;

-- Tenant-owned records: deleting a tenant should cascade the tenant-scoped core rows.
alter table public.parcele
  drop constraint if exists parcele_tenant_id_fkey;
alter table public.parcele
  add constraint parcele_tenant_id_fkey
  foreign key (tenant_id) references public.tenants(id) on delete cascade;

alter table public.activitati_agricole
  drop constraint if exists activitati_agricole_tenant_id_fkey;
alter table public.activitati_agricole
  add constraint activitati_agricole_tenant_id_fkey
  foreign key (tenant_id) references public.tenants(id) on delete cascade;

alter table public.recoltari
  drop constraint if exists recoltari_tenant_id_fkey;
alter table public.recoltari
  add constraint recoltari_tenant_id_fkey
  foreign key (tenant_id) references public.tenants(id) on delete cascade;

alter table public.clienti
  drop constraint if exists clienti_tenant_id_fkey;
alter table public.clienti
  add constraint clienti_tenant_id_fkey
  foreign key (tenant_id) references public.tenants(id) on delete cascade;

alter table public.cheltuieli_diverse
  drop constraint if exists cheltuieli_diverse_tenant_id_fkey;
alter table public.cheltuieli_diverse
  add constraint cheltuieli_diverse_tenant_id_fkey
  foreign key (tenant_id) references public.tenants(id) on delete cascade;

alter table public.culegatori
  drop constraint if exists culegatori_tenant_id_fkey;
alter table public.culegatori
  add constraint culegatori_tenant_id_fkey
  foreign key (tenant_id) references public.tenants(id) on delete cascade;

alter table public.investitii
  drop constraint if exists investitii_tenant_id_fkey;
alter table public.investitii
  add constraint investitii_tenant_id_fkey
  foreign key (tenant_id) references public.tenants(id) on delete cascade;

alter table public.profiles
  drop constraint if exists profiles_tenant_fk;
alter table public.profiles
  add constraint profiles_tenant_fk
  foreign key (tenant_id) references public.tenants(id) on delete set null;

-- Business links that should survive parent deletion with the reference nulled out.
alter table public.activitati_agricole
  drop constraint if exists activitati_agricole_parcela_id_fkey;
alter table public.activitati_agricole
  add constraint activitati_agricole_parcela_id_fkey
  foreign key (parcela_id) references public.parcele(id) on delete set null;

alter table public.recoltari
  drop constraint if exists recoltari_culegator_id_fkey;
alter table public.recoltari
  add constraint recoltari_culegator_id_fkey
  foreign key (culegator_id) references public.culegatori(id) on delete set null;

alter table public.vanzari
  drop constraint if exists vanzari_client_id_fkey;
alter table public.vanzari
  add constraint vanzari_client_id_fkey
  foreign key (client_id) references public.clienti(id) on delete set null;

notify pgrst, 'reload schema';
