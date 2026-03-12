-- Ensure tenant insert is allowed only for the authenticated owner user.
alter table public.tenants enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tenants'
      and policyname = 'tenant_owner_insert'
  ) then
    create policy tenant_owner_insert
    on public.tenants
    for insert
    with check (owner_user_id = auth.uid());
  end if;
end $$;

