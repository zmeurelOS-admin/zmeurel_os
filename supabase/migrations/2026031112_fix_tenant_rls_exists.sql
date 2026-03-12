do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'parcele',
    'activitati_agricole',
    'recoltari',
    'vanzari',
    'clienti',
    'cheltuieli_diverse',
    'culegatori',
    'investitii',
    'comenzi',
    'vanzari_butasi',
    'solar_climate_logs',
    'culture_stage_logs'
  ] loop
    if to_regclass('public.' || tbl) is null then
      continue;
    end if;

    execute format('drop policy if exists %I on public.%I', tbl || '_tenant_select', tbl);
    execute format(
      'create policy %I on public.%I for select using (exists (select 1 from public.tenants t where t.id = tenant_id and t.owner_user_id = auth.uid()))',
      tbl || '_tenant_select',
      tbl
    );

    execute format('drop policy if exists %I on public.%I', tbl || '_tenant_insert', tbl);
    execute format(
      'create policy %I on public.%I for insert with check (exists (select 1 from public.tenants t where t.id = tenant_id and t.owner_user_id = auth.uid()))',
      tbl || '_tenant_insert',
      tbl
    );

    execute format('drop policy if exists %I on public.%I', tbl || '_tenant_update', tbl);
    execute format(
      'create policy %I on public.%I for update using (exists (select 1 from public.tenants t where t.id = tenant_id and t.owner_user_id = auth.uid())) with check (exists (select 1 from public.tenants t where t.id = tenant_id and t.owner_user_id = auth.uid()))',
      tbl || '_tenant_update',
      tbl
    );

    execute format('drop policy if exists %I on public.%I', tbl || '_tenant_delete', tbl);
    execute format(
      'create policy %I on public.%I for delete using (exists (select 1 from public.tenants t where t.id = tenant_id and t.owner_user_id = auth.uid()))',
      tbl || '_tenant_delete',
      tbl
    );
  end loop;

  foreach tbl in array array[
    'recoltari',
    'vanzari',
    'activitati_agricole',
    'cheltuieli_diverse'
  ] loop
    if to_regclass('public.' || tbl) is null then
      continue;
    end if;

    execute format('drop policy if exists %I on public.%I', tbl || '_owner_update', tbl);
    execute format(
      'create policy %I on public.%I for update using (exists (select 1 from public.tenants t where t.id = tenant_id and t.owner_user_id = auth.uid()) and coalesce(created_by, auth.uid()) = auth.uid()) with check (exists (select 1 from public.tenants t where t.id = tenant_id and t.owner_user_id = auth.uid()) and coalesce(created_by, auth.uid()) = auth.uid())',
      tbl || '_owner_update',
      tbl
    );
  end loop;
end
$$;

drop policy if exists miscari_stoc_select_policy on public.miscari_stoc;
create policy miscari_stoc_select_policy
on public.miscari_stoc
for select
using (
  exists (
    select 1
    from public.tenants t
    where t.id = miscari_stoc.tenant_id
      and t.owner_user_id = auth.uid()
  )
);

drop policy if exists miscari_stoc_insert_policy on public.miscari_stoc;
create policy miscari_stoc_insert_policy
on public.miscari_stoc
for insert
with check (
  exists (
    select 1
    from public.tenants t
    where t.id = miscari_stoc.tenant_id
      and t.owner_user_id = auth.uid()
  )
);

drop policy if exists miscari_stoc_update_policy on public.miscari_stoc;
create policy miscari_stoc_update_policy
on public.miscari_stoc
for update
using (
  exists (
    select 1
    from public.tenants t
    where t.id = miscari_stoc.tenant_id
      and t.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.tenants t
    where t.id = miscari_stoc.tenant_id
      and t.owner_user_id = auth.uid()
  )
);

drop policy if exists miscari_stoc_delete_policy on public.miscari_stoc;
create policy miscari_stoc_delete_policy
on public.miscari_stoc
for delete
using (
  exists (
    select 1
    from public.tenants t
    where t.id = miscari_stoc.tenant_id
      and t.owner_user_id = auth.uid()
  )
);

drop policy if exists vanzari_butasi_items_tenant_select on public.vanzari_butasi_items;
create policy vanzari_butasi_items_tenant_select
on public.vanzari_butasi_items
for select
using (
  exists (
    select 1
    from public.tenants t
    where t.id = vanzari_butasi_items.tenant_id
      and t.owner_user_id = auth.uid()
  )
);

drop policy if exists vanzari_butasi_items_tenant_insert on public.vanzari_butasi_items;
create policy vanzari_butasi_items_tenant_insert
on public.vanzari_butasi_items
for insert
with check (
  exists (
    select 1
    from public.tenants t
    where t.id = vanzari_butasi_items.tenant_id
      and t.owner_user_id = auth.uid()
  )
  and exists (
    select 1
    from public.vanzari_butasi vb
    where vb.id = vanzari_butasi_items.comanda_id
      and vb.tenant_id = vanzari_butasi_items.tenant_id
  )
);

drop policy if exists vanzari_butasi_items_tenant_update on public.vanzari_butasi_items;
create policy vanzari_butasi_items_tenant_update
on public.vanzari_butasi_items
for update
using (
  exists (
    select 1
    from public.tenants t
    where t.id = vanzari_butasi_items.tenant_id
      and t.owner_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.tenants t
    where t.id = vanzari_butasi_items.tenant_id
      and t.owner_user_id = auth.uid()
  )
  and exists (
    select 1
    from public.vanzari_butasi vb
    where vb.id = vanzari_butasi_items.comanda_id
      and vb.tenant_id = vanzari_butasi_items.tenant_id
  )
);

drop policy if exists vanzari_butasi_items_tenant_delete on public.vanzari_butasi_items;
create policy vanzari_butasi_items_tenant_delete
on public.vanzari_butasi_items
for delete
using (
  exists (
    select 1
    from public.tenants t
    where t.id = vanzari_butasi_items.tenant_id
      and t.owner_user_id = auth.uid()
  )
);

notify pgrst, 'reload schema';
