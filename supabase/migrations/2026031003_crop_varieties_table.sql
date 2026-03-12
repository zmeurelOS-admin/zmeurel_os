-- Crop varieties catalog: global rows (tenant_id null) + tenant custom rows.
-- Keeps existing parcel crop fields untouched.

create table if not exists public.crop_varieties (
  id uuid primary key default gen_random_uuid(),
  crop_id uuid not null references public.crops(id) on delete cascade,
  name text not null,
  tenant_id uuid null references public.tenants(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists crop_varieties_crop_id_idx
  on public.crop_varieties (crop_id);

create index if not exists crop_varieties_tenant_id_idx
  on public.crop_varieties (tenant_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'crop_varieties_name_not_blank'
  ) then
    alter table public.crop_varieties
      add constraint crop_varieties_name_not_blank
      check (char_length(trim(name)) > 0);
  end if;
end
$$;

create unique index if not exists crop_varieties_scope_name_uniq_idx
  on public.crop_varieties (
    crop_id,
    coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(name)
  );

alter table public.crop_varieties enable row level security;

drop policy if exists crop_varieties_tenant_select on public.crop_varieties;
create policy crop_varieties_tenant_select
on public.crop_varieties
for select
using (
  tenant_id is null
  or tenant_id = (
    select id
    from public.tenants
    where owner_user_id = auth.uid()
    limit 1
  )
);

drop policy if exists crop_varieties_tenant_insert on public.crop_varieties;
create policy crop_varieties_tenant_insert
on public.crop_varieties
for insert
with check (
  tenant_id = (
    select id
    from public.tenants
    where owner_user_id = auth.uid()
    limit 1
  )
);

drop policy if exists crop_varieties_tenant_update on public.crop_varieties;
create policy crop_varieties_tenant_update
on public.crop_varieties
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

drop policy if exists crop_varieties_tenant_delete on public.crop_varieties;
create policy crop_varieties_tenant_delete
on public.crop_varieties
for delete
using (
  tenant_id = (
    select id
    from public.tenants
    where owner_user_id = auth.uid()
    limit 1
  )
);
