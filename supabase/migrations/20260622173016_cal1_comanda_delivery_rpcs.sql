
create or replace function public.set_comanda_in_delivery_with_reservation(p_comanda_id uuid)
returns public.comenzi language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid(); v_tenant_id uuid; v_order public.comenzi;
  v_reserved_count integer := 0; v_reserved_kg numeric := 0;
begin
  if v_user_id is null then raise exception 'Neautorizat'; end if;
  select public.current_tenant_id() into v_tenant_id;
  if v_tenant_id is null then raise exception 'Tenant invalid pentru utilizatorul curent.'; end if;
  if not (public.is_tenant_owner(v_tenant_id) or public.operator_can_write('comenzi')) then raise exception 'forbidden_read_only'; end if;
  perform pg_advisory_xact_lock(hashtext('stock-mutation'), hashtext(v_tenant_id::text));
  select * into v_order from public.comenzi where id = p_comanda_id and tenant_id = v_tenant_id for update;
  if not found then raise exception 'Comanda este invalidă pentru tenantul curent.'; end if;
  if v_order.status = 'anulata' then raise exception 'Comanda anulată nu poate fi trimisă în livrare.'; end if;
  if v_order.status = 'livrata' or v_order.linked_vanzare_id is not null then raise exception 'Comanda este deja livrată.'; end if;

  select count(*), round(coalesce(sum(sr.cantitate_kg), 0)::numeric, 2) into v_reserved_count, v_reserved_kg
  from public.stock_reservations sr where sr.tenant_id = v_tenant_id and sr.comanda_id = v_order.id and sr.status = 'active';

  if v_order.status = 'in_livrare' and v_reserved_count > 0 and v_reserved_kg = round(coalesce(v_order.cantitate_kg, 0)::numeric, 2) then
    return v_order;
  end if;

  if v_reserved_count > 0 then
    update public.stock_reservations set status = 'released', released_at = now()
    where tenant_id = v_tenant_id and comanda_id = v_order.id and status = 'active';
  end if;

  perform public.reserve_sellable_cal1_stock(v_tenant_id, 'comanda', v_order.id, null,
    round(coalesce(v_order.cantitate_kg, 0)::numeric, 2),
    jsonb_build_object('order_kind', coalesce(v_order.order_kind, 'manual'), 'data_origin', v_order.data_origin, 'reserved_via', 'set_comanda_in_delivery_with_reservation'));

  update public.comenzi set status = 'in_livrare', updated_at = now()
  where id = v_order.id and tenant_id = v_tenant_id returning * into v_order;
  return v_order;
end;
$$;

create or replace function public.release_comanda_delivery_reservation(p_comanda_id uuid, p_next_status public.comanda_status)
returns public.comenzi language plpgsql security definer set search_path = public as $$
declare v_user_id uuid := auth.uid(); v_tenant_id uuid; v_order public.comenzi;
begin
  if v_user_id is null then raise exception 'Neautorizat'; end if;
  select public.current_tenant_id() into v_tenant_id;
  if v_tenant_id is null then raise exception 'Tenant invalid pentru utilizatorul curent.'; end if;
  if not (public.is_tenant_owner(v_tenant_id) or public.operator_can_write('comenzi')) then raise exception 'forbidden_read_only'; end if;
  if p_next_status not in ('confirmata', 'programata', 'anulata') then raise exception 'Statusul țintă este invalid pentru ieșirea din livrare.'; end if;
  perform pg_advisory_xact_lock(hashtext('stock-mutation'), hashtext(v_tenant_id::text));
  select * into v_order from public.comenzi where id = p_comanda_id and tenant_id = v_tenant_id for update;
  if not found then raise exception 'Comanda este invalidă pentru tenantul curent.'; end if;
  update public.stock_reservations set status = 'released', released_at = now()
  where tenant_id = v_tenant_id and comanda_id = v_order.id and status = 'active';
  update public.comenzi set status = p_next_status, updated_at = now()
  where id = v_order.id and tenant_id = v_tenant_id returning * into v_order;
  return v_order;
end;
$$;
;
