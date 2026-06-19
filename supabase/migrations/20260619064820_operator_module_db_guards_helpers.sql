-- Enforce farm operator module write access in the database.
-- Owner bypass remains unconditional. Operators may write only modules with level='write'
-- and may never delete. Keep in sync with src/lib/farm-members/access.ts.

create or replace function public.is_tenant_owner(p_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenants t
    where t.id = p_tenant
      and t.owner_user_id = auth.uid()
  )
$$;

create or replace function public.operator_can_write(p_module text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_modules_access jsonb;
  v_has_valid_access boolean := false;
  v_has_write_access boolean := false;
begin
  if auth.uid() is null then
    return false;
  end if;

  if p_module not in (
    'comenzi',
    'livrari',
    'recoltari',
    'clienti',
    'tratamente',
    'culegatori',
    'produse',
    'activitati'
  ) then
    return false;
  end if;

  select public.current_tenant_id()
  into v_tenant_id;

  if v_tenant_id is null then
    return false;
  end if;

  if public.is_tenant_owner(v_tenant_id) then
    return true;
  end if;

  select fm.modules_access
  into v_modules_access
  from public.farm_members fm
  where fm.user_id = auth.uid()
    and fm.tenant_id = v_tenant_id
    and fm.is_active = true
    and fm.role = 'operator'
  order by fm.created_at asc
  limit 1;

  if not found then
    return false;
  end if;

  if jsonb_typeof(v_modules_access) <> 'array' then
    return p_module in ('comenzi', 'livrari');
  end if;

  select exists (
    select 1
    from jsonb_array_elements(v_modules_access) as access_item(value)
    where access_item.value ->> 'module' in (
      'comenzi',
      'livrari',
      'recoltari',
      'clienti',
      'tratamente',
      'culegatori',
      'produse',
      'activitati'
    )
      and access_item.value ->> 'level' in ('read', 'write')
  )
  into v_has_valid_access;

  select exists (
    select 1
    from jsonb_array_elements(v_modules_access) as access_item(value)
    where access_item.value ->> 'module' = p_module
      and access_item.value ->> 'level' = 'write'
  )
  into v_has_write_access;

  if v_has_write_access then
    return true;
  end if;

  if not v_has_valid_access and p_module in ('comenzi', 'livrari') then
    return true;
  end if;

  return false;
end;
$$;

create or replace function public.operator_is_operator()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
begin
  if auth.uid() is null then
    return false;
  end if;

  select public.current_tenant_id()
  into v_tenant_id;

  if v_tenant_id is null or public.is_tenant_owner(v_tenant_id) then
    return false;
  end if;

  return exists (
    select 1
    from public.farm_members fm
    where fm.user_id = auth.uid()
      and fm.tenant_id = v_tenant_id
      and fm.is_active = true
      and fm.role = 'operator'
  );
end;
$$;

revoke all on function public.is_tenant_owner(uuid) from public;
revoke all on function public.operator_can_write(text) from public;
revoke all on function public.operator_is_operator() from public;
grant execute on function public.is_tenant_owner(uuid) to authenticated, service_role;
grant execute on function public.operator_can_write(text) to authenticated, service_role;
grant execute on function public.operator_is_operator() to authenticated, service_role;

