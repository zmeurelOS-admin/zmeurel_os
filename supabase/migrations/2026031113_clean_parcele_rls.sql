do $$
declare
    r record;
begin
    for r in (
        select policyname
        from pg_policies
        where schemaname = 'public'
        and tablename = 'parcele'
    )
    loop
        execute format(
            'drop policy if exists %I on public.parcele',
            r.policyname
        );
    end loop;
end $$;

create policy parcele_tenant_select
on public.parcele
for select
using (
    tenant_id = (
        select id
        from tenants
        where owner_user_id = auth.uid()
        limit 1
    )
);

create policy parcele_tenant_insert
on public.parcele
for insert
with check (
    tenant_id = (
        select id
        from tenants
        where owner_user_id = auth.uid()
        limit 1
    )
);

create policy parcele_tenant_update
on public.parcele
for update
using (
    tenant_id = (
        select id
        from tenants
        where owner_user_id = auth.uid()
        limit 1
    )
)
with check (
    tenant_id = (
        select id
        from tenants
        where owner_user_id = auth.uid()
        limit 1
    )
);

create policy parcele_tenant_delete
on public.parcele
for delete
using (
    tenant_id = (
        select id
        from tenants
        where owner_user_id = auth.uid()
        limit 1
    )
);

create policy parcele_superadmin_all
on public.parcele
for all
using (is_superadmin())
with check (is_superadmin());
