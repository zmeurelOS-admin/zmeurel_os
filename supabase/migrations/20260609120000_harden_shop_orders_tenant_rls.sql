-- Restrict shop_orders to the current tenant and restore least-privilege grants.
-- The canonical public order endpoint uses service_role and sets tenant_id from SHOP_TENANT_ID.

revoke select, insert, update, delete, truncate, references, trigger
  on table public.shop_orders
  from anon, authenticated;

grant insert on table public.shop_orders to anon;
grant select, update on table public.shop_orders to authenticated;

drop policy if exists "anon can insert shop_orders" on public.shop_orders;
drop policy if exists "authenticated can select shop_orders" on public.shop_orders;
drop policy if exists "authenticated can update shop_orders" on public.shop_orders;

create policy "anon can insert shop_orders"
  on public.shop_orders
  for insert
  to anon
  with check (tenant_id is not null);

create policy "authenticated can select shop_orders"
  on public.shop_orders
  for select
  to authenticated
  using (tenant_id = public.current_tenant_id());

create policy "authenticated can update shop_orders"
  on public.shop_orders
  for update
  to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

notify pgrst, 'reload schema';
