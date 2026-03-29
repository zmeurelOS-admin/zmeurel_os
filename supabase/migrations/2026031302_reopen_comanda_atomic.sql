create or replace function public.reopen_comanda_atomic(
  p_comanda_id uuid,
  p_tenant_id uuid default null
)
returns public.comenzi
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid := coalesce(p_tenant_id, public.current_tenant_id());
  v_order public.comenzi;
  v_reopened public.comenzi;
  v_reopen_status public.comanda_status;
  v_blocking_children integer := 0;
begin
  if v_user_id is null then
    raise exception 'Neautorizat';
  end if;

  if v_tenant_id is null then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  perform pg_advisory_xact_lock(hashtext('reopen-order'), hashtext(v_tenant_id::text));

  select *
  into v_order
  from public.comenzi
  where id = p_comanda_id
    and tenant_id = v_tenant_id
  for update;

  if not found then
    raise exception 'Comanda este invalida pentru tenantul curent.';
  end if;

  if v_order.status <> 'livrata' then
    raise exception 'Doar comenzile livrate pot fi redeschise.';
  end if;

  select count(*)
  into v_blocking_children
  from public.comenzi child_order
  where child_order.tenant_id = v_tenant_id
    and child_order.parent_comanda_id = v_order.id
    and (
      child_order.linked_vanzare_id is not null
      or child_order.status = 'livrata'
    );

  if v_blocking_children > 0 then
    raise exception 'Comanda are livrari ulterioare si nu poate fi redeschisa.';
  end if;

  if v_order.linked_vanzare_id is not null then
    perform public.delete_vanzare_with_stock(v_order.linked_vanzare_id);
  end if;

  delete from public.comenzi child_order
  where child_order.tenant_id = v_tenant_id
    and child_order.parent_comanda_id = v_order.id
    and child_order.linked_vanzare_id is null;

  v_reopen_status := case
    when v_order.data_livrare is not null and v_order.data_livrare > current_date
      then 'programata'::public.comanda_status
    else 'confirmata'::public.comanda_status
  end;

  update public.comenzi
  set status = v_reopen_status,
      linked_vanzare_id = null,
      updated_at = now(),
      observatii = concat_ws(
        ' | ',
        nullif(btrim(coalesce(v_order.observatii, '')), ''),
        'Comanda redeschisa'
      )
  where id = v_order.id
    and tenant_id = v_tenant_id
  returning *
  into v_reopened;

  return v_reopened;
end;
$$;
