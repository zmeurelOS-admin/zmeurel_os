-- Operator invites and module-level access.
-- Additive migration: keeps livrator flow and existing farm_members owner policy intact.

alter table public.farm_members
  add column if not exists modules_access jsonb not null default '[]'::jsonb;

comment on column public.farm_members.modules_access is
  'Module access for operator members, e.g. [{"module":"comenzi","level":"write"}]. Empty operators use legacy fallback in app code.';

create table if not exists public.farm_invites (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  token text not null unique,
  modules_access jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by_user_id uuid references auth.users(id) on delete set null
);

comment on table public.farm_invites is
  'One-time signup invite links for operator accounts that join an existing farm without creating their own tenant.';
comment on column public.farm_invites.modules_access is
  'Module access copied to farm_members when the invite is accepted.';

alter table public.farm_invites enable row level security;

drop policy if exists "only owner can manage farm_invites" on public.farm_invites;
create policy "only owner can manage farm_invites"
  on public.farm_invites
  for all
  to authenticated
  using (
    tenant_id in (
      select t.id
      from public.tenants t
      where t.owner_user_id = auth.uid()
    )
  )
  with check (
    tenant_id in (
      select t.id
      from public.tenants t
      where t.owner_user_id = auth.uid()
    )
  );

drop policy if exists "member can read own row" on public.farm_members;
create policy "member can read own row"
  on public.farm_members
  for select
  to authenticated
  using (user_id = auth.uid());

create index if not exists farm_invites_token_idx
  on public.farm_invites (token);

create index if not exists farm_invites_tenant_id_idx
  on public.farm_invites (tenant_id);

grant select, insert, update on public.farm_invites to authenticated;

alter table public.comenzi
  add column if not exists created_by uuid,
  add column if not exists updated_by uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'comenzi_created_by_fkey') then
    alter table public.comenzi
      add constraint comenzi_created_by_fkey foreign key (created_by) references auth.users(id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'comenzi_updated_by_fkey') then
    alter table public.comenzi
      add constraint comenzi_updated_by_fkey foreign key (updated_by) references auth.users(id);
  end if;
end
$$;

create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select t.id
      from public.tenants t
      where t.owner_user_id = auth.uid()
      order by t.created_at asc
      limit 1
    ),
    (
      select fm.tenant_id
      from public.farm_members fm
      where fm.user_id = auth.uid()
        and fm.is_active = true
        and fm.role = 'operator'
      order by fm.created_at asc
      limit 1
    )
  )
$$;

notify pgrst, 'reload schema';
