create or replace function public.delete_comanda_atomic(
  p_comanda_id uuid,
  p_tenant_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid := coalesce(p_tenant_id, public.current_tenant_id());
  v_order public.comenzi;
begin
  if v_user_id is null then
    raise exception 'Neautorizat';
  end if;

  if v_tenant_id is null then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  perform pg_advisory_xact_lock(hashtext('delete-order'), hashtext(v_tenant_id::text));

  select *
  into v_order
  from public.comenzi
  where id = p_comanda_id
    and tenant_id = v_tenant_id
  for update;

  if not found then
    raise exception 'Comanda este invalida pentru tenantul curent.';
  end if;

  if v_order.linked_vanzare_id is not null then
    perform public.delete_vanzare_with_stock(v_order.linked_vanzare_id);
  end if;

  delete from public.comenzi
  where id = v_order.id
    and tenant_id = v_tenant_id;
end;
$$;
