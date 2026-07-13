-- INTENTIONALLY NOT APPLIED ON PRODUCTION.
-- The financial RLS policies below are not active. User decision confirmed
-- on 2026-07-13. Do not mark this migration as applied or restore it to the
-- active migration directory without new explicit confirmation.
-- See supabase/migrations_archive/README.md for the reconciliation context.

-- Financial modules must remain owner-only even on projects that still carry
-- older tenant-wide policy names from previous migration histories.

drop policy if exists cheltuieli_diverse_select on public.cheltuieli_diverse;
drop policy if exists cheltuieli_diverse_insert on public.cheltuieli_diverse;
drop policy if exists cheltuieli_diverse_update on public.cheltuieli_diverse;
drop policy if exists cheltuieli_diverse_delete on public.cheltuieli_diverse;
drop policy if exists cheltuieli_diverse_tenant_select on public.cheltuieli_diverse;
drop policy if exists cheltuieli_diverse_tenant_insert on public.cheltuieli_diverse;
drop policy if exists cheltuieli_diverse_tenant_update on public.cheltuieli_diverse;
drop policy if exists cheltuieli_diverse_tenant_delete on public.cheltuieli_diverse;
drop policy if exists cheltuieli_diverse_owner_select on public.cheltuieli_diverse;
drop policy if exists cheltuieli_diverse_owner_insert on public.cheltuieli_diverse;
drop policy if exists cheltuieli_diverse_owner_update on public.cheltuieli_diverse;
drop policy if exists cheltuieli_diverse_owner_delete on public.cheltuieli_diverse;

create policy cheltuieli_diverse_select
on public.cheltuieli_diverse
for select
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.is_tenant_owner(tenant_id)
);

create policy cheltuieli_diverse_insert
on public.cheltuieli_diverse
for insert
to authenticated
with check (
  tenant_id = public.current_tenant_id()
  and public.is_tenant_owner(tenant_id)
);

create policy cheltuieli_diverse_update
on public.cheltuieli_diverse
for update
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.is_tenant_owner(tenant_id)
)
with check (
  tenant_id = public.current_tenant_id()
  and public.is_tenant_owner(tenant_id)
);

create policy cheltuieli_diverse_delete
on public.cheltuieli_diverse
for delete
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.is_tenant_owner(tenant_id)
);

drop policy if exists investitii_select on public.investitii;
drop policy if exists investitii_insert on public.investitii;
drop policy if exists investitii_update on public.investitii;
drop policy if exists investitii_delete on public.investitii;
drop policy if exists investitii_tenant_select on public.investitii;
drop policy if exists investitii_tenant_insert on public.investitii;
drop policy if exists investitii_tenant_update on public.investitii;
drop policy if exists investitii_tenant_delete on public.investitii;
drop policy if exists investitii_owner_select on public.investitii;
drop policy if exists investitii_owner_insert on public.investitii;
drop policy if exists investitii_owner_update on public.investitii;
drop policy if exists investitii_owner_delete on public.investitii;

create policy investitii_select
on public.investitii
for select
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.is_tenant_owner(tenant_id)
);

create policy investitii_insert
on public.investitii
for insert
to authenticated
with check (
  tenant_id = public.current_tenant_id()
  and public.is_tenant_owner(tenant_id)
);

create policy investitii_update
on public.investitii
for update
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.is_tenant_owner(tenant_id)
)
with check (
  tenant_id = public.current_tenant_id()
  and public.is_tenant_owner(tenant_id)
);

create policy investitii_delete
on public.investitii
for delete
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.is_tenant_owner(tenant_id)
);

notify pgrst, 'reload schema';
