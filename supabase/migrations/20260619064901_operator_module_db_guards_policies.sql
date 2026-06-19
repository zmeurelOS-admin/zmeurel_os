do $$
declare
  v_table text;
  v_policy record;
begin
  foreach v_table in array array[
    'comenzi',
    'recoltari',
    'clienti',
    'culegatori',
    'activitati_agricole',
    'planuri_tratament',
    'planuri_tratament_linii',
    'planuri_tratament_linie_produse',
    'aplicari_tratament',
    'aplicari_tratament_produse',
    'parcele_planuri',
    'produse_fitosanitare',
    'capcane_montate',
    'capcane_verificari'
  ]
  loop
    for v_policy in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = v_table
        and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
        and not (
          v_table = 'comenzi'
          and policyname in ('comenzi_association_select', 'comenzi_association_update')
        )
    loop
      execute format('drop policy if exists %I on public.%I', v_policy.policyname, v_table);
    end loop;
  end loop;

  for v_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'produse'
      and (
        cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
        or policyname = 'produse_select_tenant'
      )
      and policyname not in (
        'produse_insert_association_staff_approved_tenant',
        'produse_update_association_staff',
        'association_members_read_products'
      )
  loop
    execute format('drop policy if exists %I on public.produse', v_policy.policyname);
  end loop;

  for v_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'shop_orders'
      and cmd in ('UPDATE', 'ALL')
  loop
    execute format('drop policy if exists %I on public.shop_orders', v_policy.policyname);
  end loop;
end
$$;

do $$
declare
  v_table text;
  v_module text;
begin
  for v_table, v_module in
    select table_name, module_name
    from (
      values
        ('comenzi', 'comenzi'),
        ('recoltari', 'recoltari'),
        ('clienti', 'clienti'),
        ('culegatori', 'culegatori'),
        ('activitati_agricole', 'activitati'),
        ('planuri_tratament', 'tratamente'),
        ('planuri_tratament_linii', 'tratamente'),
        ('aplicari_tratament', 'tratamente'),
        ('parcele_planuri', 'tratamente'),
        ('produse_fitosanitare', 'tratamente'),
        ('capcane_montate', 'tratamente'),
        ('capcane_verificari', 'tratamente')
    ) as module_tables(table_name, module_name)
  loop
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (tenant_id = public.current_tenant_id() and (public.is_tenant_owner(tenant_id) or public.operator_can_write(%L)))',
      v_table || '_insert',
      v_table,
      v_module
    );

    execute format(
      'create policy %I on public.%I for update to authenticated using (tenant_id = public.current_tenant_id() and (public.is_tenant_owner(tenant_id) or public.operator_can_write(%L))) with check (tenant_id = public.current_tenant_id() and (public.is_tenant_owner(tenant_id) or public.operator_can_write(%L)))',
      v_table || '_update',
      v_table,
      v_module,
      v_module
    );

    execute format(
      'create policy %I on public.%I for delete to authenticated using (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id))',
      v_table || '_delete',
      v_table
    );
  end loop;
end
$$;

create policy produse_select_tenant
  on public.produse
  for select
  to authenticated
  using (tenant_id = public.current_tenant_id());

create policy produse_insert_tenant
  on public.produse
  for insert
  to authenticated
  with check (
    tenant_id = public.current_tenant_id()
    and (public.is_tenant_owner(tenant_id) or public.operator_can_write('produse'))
  );

create policy produse_update_tenant
  on public.produse
  for update
  to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and (public.is_tenant_owner(tenant_id) or public.operator_can_write('produse'))
  )
  with check (
    tenant_id = public.current_tenant_id()
    and (public.is_tenant_owner(tenant_id) or public.operator_can_write('produse'))
  );

create policy produse_delete_tenant
  on public.produse
  for delete
  to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and public.is_tenant_owner(tenant_id)
  );

create policy planuri_tratament_linie_produse_insert
  on public.planuri_tratament_linie_produse
  for insert
  to authenticated
  with check (
    tenant_id = public.current_tenant_id()
    and (public.is_tenant_owner(tenant_id) or public.operator_can_write('tratamente'))
    and exists (
      select 1
      from public.planuri_tratament_linii linie
      where linie.id = plan_linie_id
        and linie.tenant_id = public.current_tenant_id()
    )
    and (
      produs_id is null
      or exists (
        select 1
        from public.produse_fitosanitare produs
        where produs.id = produs_id
          and (produs.tenant_id is null or produs.tenant_id = public.current_tenant_id())
      )
    )
  );

create policy planuri_tratament_linie_produse_update
  on public.planuri_tratament_linie_produse
  for update
  to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and (public.is_tenant_owner(tenant_id) or public.operator_can_write('tratamente'))
  )
  with check (
    tenant_id = public.current_tenant_id()
    and (public.is_tenant_owner(tenant_id) or public.operator_can_write('tratamente'))
    and exists (
      select 1
      from public.planuri_tratament_linii linie
      where linie.id = plan_linie_id
        and linie.tenant_id = public.current_tenant_id()
    )
    and (
      produs_id is null
      or exists (
        select 1
        from public.produse_fitosanitare produs
        where produs.id = produs_id
          and (produs.tenant_id is null or produs.tenant_id = public.current_tenant_id())
      )
    )
  );

create policy planuri_tratament_linie_produse_delete
  on public.planuri_tratament_linie_produse
  for delete
  to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and public.is_tenant_owner(tenant_id)
  );

create policy aplicari_tratament_produse_insert
  on public.aplicari_tratament_produse
  for insert
  to authenticated
  with check (
    tenant_id = public.current_tenant_id()
    and (public.is_tenant_owner(tenant_id) or public.operator_can_write('tratamente'))
    and exists (
      select 1
      from public.aplicari_tratament aplicare
      where aplicare.id = aplicare_id
        and aplicare.tenant_id = public.current_tenant_id()
    )
    and (
      plan_linie_produs_id is null
      or exists (
        select 1
        from public.planuri_tratament_linie_produse plan_produs
        where plan_produs.id = plan_linie_produs_id
          and plan_produs.tenant_id = public.current_tenant_id()
      )
    )
    and (
      produs_id is null
      or exists (
        select 1
        from public.produse_fitosanitare produs
        where produs.id = produs_id
          and (produs.tenant_id is null or produs.tenant_id = public.current_tenant_id())
      )
    )
  );

create policy aplicari_tratament_produse_update
  on public.aplicari_tratament_produse
  for update
  to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and (public.is_tenant_owner(tenant_id) or public.operator_can_write('tratamente'))
  )
  with check (
    tenant_id = public.current_tenant_id()
    and (public.is_tenant_owner(tenant_id) or public.operator_can_write('tratamente'))
    and exists (
      select 1
      from public.aplicari_tratament aplicare
      where aplicare.id = aplicare_id
        and aplicare.tenant_id = public.current_tenant_id()
    )
    and (
      plan_linie_produs_id is null
      or exists (
        select 1
        from public.planuri_tratament_linie_produse plan_produs
        where plan_produs.id = plan_linie_produs_id
          and plan_produs.tenant_id = public.current_tenant_id()
      )
    )
    and (
      produs_id is null
      or exists (
        select 1
        from public.produse_fitosanitare produs
        where produs.id = produs_id
          and (produs.tenant_id is null or produs.tenant_id = public.current_tenant_id())
      )
    )
  );

create policy aplicari_tratament_produse_delete
  on public.aplicari_tratament_produse
  for delete
  to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and public.is_tenant_owner(tenant_id)
  );

create policy "authenticated can update shop_orders"
  on public.shop_orders
  for update
  to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and (
      public.is_tenant_owner(tenant_id)
      or public.operator_can_write('comenzi')
      or public.operator_can_write('livrari')
    )
  )
  with check (
    tenant_id = public.current_tenant_id()
    and (
      public.is_tenant_owner(tenant_id)
      or public.operator_can_write('comenzi')
      or public.operator_can_write('livrari')
    )
  );

