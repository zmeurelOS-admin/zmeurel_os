create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.tenants
  where owner_user_id = auth.uid()
  order by created_at asc
  limit 1
$$;

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
    'vanzari_butasi'
  ] loop
    if to_regclass('public.' || tbl) is null then
      continue;
    end if;

    execute format('drop policy if exists %I on public.%I', tbl || '_tenant_select', tbl);
    execute format(
      'create policy %I on public.%I for select using (tenant_id = public.current_tenant_id())',
      tbl || '_tenant_select',
      tbl
    );

    execute format('drop policy if exists %I on public.%I', tbl || '_tenant_insert', tbl);
    execute format(
      'create policy %I on public.%I for insert with check (tenant_id = public.current_tenant_id())',
      tbl || '_tenant_insert',
      tbl
    );

    execute format('drop policy if exists %I on public.%I', tbl || '_tenant_update', tbl);
    execute format(
      'create policy %I on public.%I for update using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id())',
      tbl || '_tenant_update',
      tbl
    );

    execute format('drop policy if exists %I on public.%I', tbl || '_tenant_delete', tbl);
    execute format(
      'create policy %I on public.%I for delete using (tenant_id = public.current_tenant_id())',
      tbl || '_tenant_delete',
      tbl
    );
  end loop;

  foreach tbl in array array[
    'activitati_agricole',
    'recoltari',
    'vanzari',
    'cheltuieli_diverse'
  ] loop
    if to_regclass('public.' || tbl) is null then
      continue;
    end if;

    execute format('drop policy if exists %I on public.%I', tbl || '_owner_update', tbl);
    execute format(
      'create policy %I on public.%I for update using (tenant_id = public.current_tenant_id() and coalesce(created_by, auth.uid()) = auth.uid()) with check (tenant_id = public.current_tenant_id() and coalesce(created_by, auth.uid()) = auth.uid())',
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
  tenant_id = public.current_tenant_id()
);

drop policy if exists miscari_stoc_insert_policy on public.miscari_stoc;
create policy miscari_stoc_insert_policy
on public.miscari_stoc
for insert
with check (
  tenant_id = public.current_tenant_id()
);

drop policy if exists miscari_stoc_update_policy on public.miscari_stoc;
create policy miscari_stoc_update_policy
on public.miscari_stoc
for update
using (
  tenant_id = public.current_tenant_id()
)
with check (
  tenant_id = public.current_tenant_id()
);

drop policy if exists miscari_stoc_delete_policy on public.miscari_stoc;
create policy miscari_stoc_delete_policy
on public.miscari_stoc
for delete
using (
  tenant_id = public.current_tenant_id()
);

drop policy if exists vanzari_butasi_items_tenant_select on public.vanzari_butasi_items;
create policy vanzari_butasi_items_tenant_select
on public.vanzari_butasi_items
for select
using (
  tenant_id = public.current_tenant_id()
);

drop policy if exists vanzari_butasi_items_tenant_insert on public.vanzari_butasi_items;
create policy vanzari_butasi_items_tenant_insert
on public.vanzari_butasi_items
for insert
with check (
  tenant_id = public.current_tenant_id()
  and exists (
    select 1
    from public.vanzari_butasi vb
    where vb.id = comanda_id
      and vb.tenant_id = vanzari_butasi_items.tenant_id
  )
);

drop policy if exists vanzari_butasi_items_tenant_update on public.vanzari_butasi_items;
create policy vanzari_butasi_items_tenant_update
on public.vanzari_butasi_items
for update
using (
  tenant_id = public.current_tenant_id()
)
with check (
  tenant_id = public.current_tenant_id()
  and exists (
    select 1
    from public.vanzari_butasi vb
    where vb.id = comanda_id
      and vb.tenant_id = vanzari_butasi_items.tenant_id
  )
);

drop policy if exists vanzari_butasi_items_tenant_delete on public.vanzari_butasi_items;
create policy vanzari_butasi_items_tenant_delete
on public.vanzari_butasi_items
for delete
using (
  tenant_id = public.current_tenant_id()
);

notify pgrst, 'reload schema';
