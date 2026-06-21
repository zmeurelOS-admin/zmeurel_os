-- Restrict parcela deletion to tenant owners only.
-- Read access remains tenant-wide for all tenant operators by design.
-- Insert/update policies remain unchanged and continue to use module-level write access.

drop policy if exists parcele_delete on public.parcele;

create policy parcele_delete
on public.parcele
for delete
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.is_tenant_owner(tenant_id)
);
