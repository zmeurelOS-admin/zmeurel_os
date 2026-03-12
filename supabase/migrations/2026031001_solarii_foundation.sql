-- Minimal DB foundation for mixed units: camp / solar / livada
-- Extends existing parcele model and adds greenhouse log tables.

alter table public.parcele
  add column if not exists tip_unitate text not null default 'camp',
  add column if not exists cultura text,
  add column if not exists soi text,
  add column if not exists nr_randuri integer,
  add column if not exists distanta_intre_randuri numeric,
  add column if not exists sistem_irigare text,
  add column if not exists data_plantarii date;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'parcele_tip_unitate_check'
  ) then
    alter table public.parcele
      add constraint parcele_tip_unitate_check
      check (tip_unitate in ('camp', 'solar', 'livada'));
  end if;
end
$$;

create table if not exists public.solar_climate_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unitate_id uuid not null references public.parcele(id) on delete cascade,
  temperatura numeric not null,
  umiditate numeric not null,
  observatii text,
  created_at timestamptz not null default now()
);

create index if not exists solar_climate_logs_tenant_unitate_created_idx
  on public.solar_climate_logs (tenant_id, unitate_id, created_at desc);

create index if not exists solar_climate_logs_created_idx
  on public.solar_climate_logs (created_at desc);

alter table public.solar_climate_logs enable row level security;

drop policy if exists solar_climate_logs_tenant_select on public.solar_climate_logs;
create policy solar_climate_logs_tenant_select
on public.solar_climate_logs
for select
using (
  tenant_id = (
    select id
    from public.tenants
    where owner_user_id = auth.uid()
    limit 1
  )
);

drop policy if exists solar_climate_logs_tenant_insert on public.solar_climate_logs;
create policy solar_climate_logs_tenant_insert
on public.solar_climate_logs
for insert
with check (
  tenant_id = (
    select id
    from public.tenants
    where owner_user_id = auth.uid()
    limit 1
  )
);

drop policy if exists solar_climate_logs_tenant_update on public.solar_climate_logs;
create policy solar_climate_logs_tenant_update
on public.solar_climate_logs
for update
using (
  tenant_id = (
    select id
    from public.tenants
    where owner_user_id = auth.uid()
    limit 1
  )
)
with check (
  tenant_id = (
    select id
    from public.tenants
    where owner_user_id = auth.uid()
    limit 1
  )
);

drop policy if exists solar_climate_logs_tenant_delete on public.solar_climate_logs;
create policy solar_climate_logs_tenant_delete
on public.solar_climate_logs
for delete
using (
  tenant_id = (
    select id
    from public.tenants
    where owner_user_id = auth.uid()
    limit 1
  )
);

drop policy if exists solar_climate_logs_superadmin_select on public.solar_climate_logs;
create policy solar_climate_logs_superadmin_select
on public.solar_climate_logs
for select
using (public.is_superadmin());

drop policy if exists solar_climate_logs_superadmin_insert on public.solar_climate_logs;
create policy solar_climate_logs_superadmin_insert
on public.solar_climate_logs
for insert
with check (public.is_superadmin());

drop policy if exists solar_climate_logs_superadmin_update on public.solar_climate_logs;
create policy solar_climate_logs_superadmin_update
on public.solar_climate_logs
for update
using (public.is_superadmin())
with check (public.is_superadmin());

drop policy if exists solar_climate_logs_superadmin_delete on public.solar_climate_logs;
create policy solar_climate_logs_superadmin_delete
on public.solar_climate_logs
for delete
using (public.is_superadmin());

create table if not exists public.culture_stage_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unitate_id uuid not null references public.parcele(id) on delete cascade,
  etapa text not null,
  data date not null,
  observatii text,
  created_at timestamptz not null default now()
);

create index if not exists culture_stage_logs_tenant_unitate_data_idx
  on public.culture_stage_logs (tenant_id, unitate_id, data desc);

create index if not exists culture_stage_logs_created_idx
  on public.culture_stage_logs (created_at desc);

alter table public.culture_stage_logs enable row level security;

drop policy if exists culture_stage_logs_tenant_select on public.culture_stage_logs;
create policy culture_stage_logs_tenant_select
on public.culture_stage_logs
for select
using (
  tenant_id = (
    select id
    from public.tenants
    where owner_user_id = auth.uid()
    limit 1
  )
);

drop policy if exists culture_stage_logs_tenant_insert on public.culture_stage_logs;
create policy culture_stage_logs_tenant_insert
on public.culture_stage_logs
for insert
with check (
  tenant_id = (
    select id
    from public.tenants
    where owner_user_id = auth.uid()
    limit 1
  )
);

drop policy if exists culture_stage_logs_tenant_update on public.culture_stage_logs;
create policy culture_stage_logs_tenant_update
on public.culture_stage_logs
for update
using (
  tenant_id = (
    select id
    from public.tenants
    where owner_user_id = auth.uid()
    limit 1
  )
)
with check (
  tenant_id = (
    select id
    from public.tenants
    where owner_user_id = auth.uid()
    limit 1
  )
);

drop policy if exists culture_stage_logs_tenant_delete on public.culture_stage_logs;
create policy culture_stage_logs_tenant_delete
on public.culture_stage_logs
for delete
using (
  tenant_id = (
    select id
    from public.tenants
    where owner_user_id = auth.uid()
    limit 1
  )
);

drop policy if exists culture_stage_logs_superadmin_select on public.culture_stage_logs;
create policy culture_stage_logs_superadmin_select
on public.culture_stage_logs
for select
using (public.is_superadmin());

drop policy if exists culture_stage_logs_superadmin_insert on public.culture_stage_logs;
create policy culture_stage_logs_superadmin_insert
on public.culture_stage_logs
for insert
with check (public.is_superadmin());

drop policy if exists culture_stage_logs_superadmin_update on public.culture_stage_logs;
create policy culture_stage_logs_superadmin_update
on public.culture_stage_logs
for update
using (public.is_superadmin())
with check (public.is_superadmin());

drop policy if exists culture_stage_logs_superadmin_delete on public.culture_stage_logs;
create policy culture_stage_logs_superadmin_delete
on public.culture_stage_logs
for delete
using (public.is_superadmin());

notify pgrst, 'reload schema';
