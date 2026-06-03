-- Interest list for unavailable public shop products.
-- No data backfill and no modification of existing user data.

create table if not exists public.shop_interest_list (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  phone text not null,
  name text,
  product_name text,
  created_at timestamptz default now(),
  notified_at timestamptz,
  unique (tenant_id, phone, product_name)
);

comment on table public.shop_interest_list is
  'Clienți potențiali pentru produse indisponibile în shop-ul public /comanda.';

alter table public.shop_interest_list enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'shop_interest_list'
      and policyname = 'Tenant owner reads interest list'
  ) then
    create policy "Tenant owner reads interest list"
      on public.shop_interest_list
      for select
      to authenticated
      using (
        tenant_id in (
          select id from public.tenants where owner_user_id = auth.uid()
        )
      );
  end if;
end $$;

grant select on public.shop_interest_list to authenticated;
