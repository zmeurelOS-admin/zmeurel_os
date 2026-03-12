drop policy if exists alert_dismissals_select on public.alert_dismissals;
create policy alert_dismissals_select
on public.alert_dismissals
for select
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.tenants t
    where t.id = tenant_id
      and t.owner_user_id = auth.uid()
  )
);

drop policy if exists crop_varieties_tenant_select on public.crop_varieties;
create policy crop_varieties_tenant_select
on public.crop_varieties
for select
using (
  tenant_id is null
  or exists (
    select 1
    from public.tenants t
    where t.id = tenant_id
      and t.owner_user_id = auth.uid()
  )
);

drop policy if exists culegatori_tenant_select on public.culegatori;
create policy culegatori_tenant_select
on public.culegatori
for select
using (
  exists (
    select 1
    from public.tenants t
    where t.id = tenant_id
      and t.owner_user_id = auth.uid()
  )
);

drop policy if exists investitii_tenant_select on public.investitii;
create policy investitii_tenant_select
on public.investitii
for select
using (
  exists (
    select 1
    from public.tenants t
    where t.id = tenant_id
      and t.owner_user_id = auth.uid()
  )
);

drop policy if exists vanzari_butasi_tenant_select on public.vanzari_butasi;
create policy vanzari_butasi_tenant_select
on public.vanzari_butasi
for select
using (
  exists (
    select 1
    from public.tenants t
    where t.id = tenant_id
      and t.owner_user_id = auth.uid()
  )
);

notify pgrst, 'reload schema';
