-- Include `parcele` in farm operator module guards.
-- Keep owner bypass and owner-only delete semantics unchanged.

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
    'parcele',
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
      'parcele',
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

drop policy if exists parcele_tenant_insert on public.parcele;
create policy parcele_tenant_insert
on public.parcele
for insert
to authenticated
with check (
  tenant_id = public.current_tenant_id()
  and (
    public.is_tenant_owner(tenant_id)
    or public.operator_can_write('parcele')
  )
);

drop policy if exists parcele_tenant_update on public.parcele;
create policy parcele_tenant_update
on public.parcele
for update
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and (
    public.is_tenant_owner(tenant_id)
    or public.operator_can_write('parcele')
  )
)
with check (
  tenant_id = public.current_tenant_id()
  and (
    public.is_tenant_owner(tenant_id)
    or public.operator_can_write('parcele')
  )
);
