-- Public shop customers remembered by phone number.
-- No data backfill: existing shop orders and customers remain untouched.

create table if not exists public.shop_customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  phone text not null,
  name text,
  email text,
  default_delivery_address text,
  default_delivery_city text,
  default_delivery_mode text default 'delivery',
  order_count integer default 1,
  last_order_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (tenant_id, phone)
);

comment on table public.shop_customers is
  'Clienți anonimi ai shop-ului public /comanda, identificați prin telefon normalizat.';
comment on column public.shop_customers.phone is
  'Telefon normalizat server-side; clienții anonimi nu pot citi această tabelă direct.';

alter table public.shop_orders
  add column if not exists delivery_city text;

comment on column public.shop_orders.delivery_city is
  'Localitate livrare pentru shop-ul public /comanda. Nullable pentru compatibilitate.';

alter table public.shop_customers enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'shop_customers'
      and policyname = 'Tenant owner can read own customers'
  ) then
    create policy "Tenant owner can read own customers"
      on public.shop_customers
      for select
      to authenticated
      using (
        tenant_id in (
          select id from public.tenants where owner_user_id = auth.uid()
        )
      );
  end if;
end $$;

grant select on public.shop_customers to authenticated;

create or replace function public.upsert_shop_customer(
  p_tenant_id uuid,
  p_phone text,
  p_name text,
  p_default_delivery_address text,
  p_default_delivery_city text,
  p_default_delivery_mode text
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.shop_customers (
    tenant_id,
    phone,
    name,
    default_delivery_address,
    default_delivery_city,
    default_delivery_mode,
    order_count,
    last_order_at,
    updated_at
  )
  values (
    p_tenant_id,
    p_phone,
    nullif(btrim(p_name), ''),
    nullif(btrim(p_default_delivery_address), ''),
    nullif(btrim(p_default_delivery_city), ''),
    coalesce(nullif(btrim(p_default_delivery_mode), ''), 'delivery'),
    1,
    now(),
    now()
  )
  on conflict (tenant_id, phone)
  do update set
    name = excluded.name,
    default_delivery_address = excluded.default_delivery_address,
    default_delivery_city = excluded.default_delivery_city,
    default_delivery_mode = excluded.default_delivery_mode,
    order_count = coalesce(public.shop_customers.order_count, 0) + 1,
    last_order_at = now(),
    updated_at = now();
$$;

revoke all on function public.upsert_shop_customer(uuid, text, text, text, text, text) from public;
grant execute on function public.upsert_shop_customer(uuid, text, text, text, text, text) to service_role;
