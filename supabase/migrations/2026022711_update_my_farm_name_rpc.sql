-- Safe farm-name update RPC without service-role dependency.
-- Uses authenticated context and strict ownership checks.

create or replace function public.update_my_farm_name(
  p_farm_name text
)
returns table (
  tenant_id uuid,
  farm_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text := btrim(coalesce(p_farm_name, ''));
begin
  if v_user_id is null then
    raise exception 'UNAUTHORIZED';
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'INVALID_FARM_NAME';
  end if;

  return query
  update public.tenants t
  set
    nume_ferma = v_name,
    updated_at = now()
  where t.owner_user_id = v_user_id
  returning t.id, t.nume_ferma;

  if not found then
    raise exception 'TENANT_NOT_FOUND';
  end if;
end
$$;

grant execute on function public.update_my_farm_name(text) to authenticated;
grant execute on function public.update_my_farm_name(text) to service_role;

notify pgrst, 'reload schema';
