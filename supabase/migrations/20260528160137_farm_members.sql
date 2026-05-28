-- Farm-level sub-users (operatori/livratori) and nullable shop order tenant marker.
-- Read-only migration with no data backfill: existing shop orders remain untouched.

create table if not exists public.farm_members (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  role text not null check (role in ('operator', 'livrator')),
  name text not null,
  phone text,
  invite_token text,
  invite_used_at timestamptz,
  is_active boolean not null default true,
  created_by uuid references auth.users(id)
);

comment on table public.farm_members is
  'Membri ai unei ferme: operatori cu cont Zmeurel OS și livratori cu acces prin token.';
comment on column public.farm_members.role is
  'Rol per fermă: operator (cont autentificat) sau livrator (token public limitat).';
comment on column public.farm_members.invite_token is
  'Token magic-link pentru livrator; stocat doar server-side/cookie httpOnly în runtime.';

alter table public.farm_members enable row level security;

drop policy if exists "only owner can manage farm_members" on public.farm_members;
create policy "only owner can manage farm_members"
  on public.farm_members
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

create index if not exists farm_members_tenant_id_idx
  on public.farm_members (tenant_id);

create index if not exists farm_members_user_id_idx
  on public.farm_members (user_id);

create unique index if not exists farm_members_invite_token_idx
  on public.farm_members (invite_token)
  where invite_token is not null;

grant select, insert, update on public.farm_members to authenticated;

alter table public.shop_orders
  add column if not exists tenant_id uuid references public.tenants(id);

comment on column public.shop_orders.tenant_id is
  'Tenant marker pentru comenzi shop public. Nullable pentru compatibilitate cu comenzile existente.';

create index if not exists shop_orders_tenant_id_idx
  on public.shop_orders (tenant_id);
