-- Livrează o comandă `in_livrare` ȘI clonează-o pentru livrarea următoare, într-o
-- singură tranzacție atomică. Folosit de checkbox-ul „Copiază comanda pentru
-- livrarea următoare” din cardul de livrare (Livrări > De livrat).
--
-- Reutilizează exact `set_comanda_delivered` pentru livrarea comenzii originale
-- (nicio duplicare a logicii de stoc/vânzare/plată) — funcția e apelată din
-- interiorul acestei tranzacții, deci un eșec oriunde (validare, livrare, insert
-- clonă) face rollback automat pe ambele efecte.
create or replace function public.deliver_and_clone_comanda(
  p_comanda_id uuid,
  p_new_cantitate_kg numeric,
  p_new_data_livrare date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_order public.comenzi;
  v_delivery_result jsonb;
  v_delivered_order jsonb;
  v_new_order public.comenzi;
begin
  if v_user_id is null then
    raise exception 'Neautorizat';
  end if;

  select public.current_tenant_id()
  into v_tenant_id;

  if v_tenant_id is null then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  if not (public.is_tenant_owner(v_tenant_id) or public.operator_can_write('comenzi')) then
    raise exception 'forbidden_read_only';
  end if;

  if p_new_cantitate_kg is null or p_new_cantitate_kg <= 0 then
    raise exception 'Cantitatea comenzii noi trebuie să fie mai mare decât 0.';
  end if;

  if p_new_data_livrare is null then
    raise exception 'Data de livrare a comenzii noi este obligatorie.';
  end if;

  select *
  into v_order
  from public.comenzi
  where id = p_comanda_id
    and tenant_id = v_tenant_id
  for update;

  if not found then
    raise exception 'Comanda este invalidă pentru tenantul curent.';
  end if;

  if v_order.status <> 'in_livrare' then
    raise exception 'Doar comenzile aflate în livrare pot fi livrate cu clonare pentru livrarea următoare.';
  end if;

  -- Livrare identică cu fluxul existent (creează vânzarea, marchează
  -- `livrata`, calculează stocul) — nicio logică nouă, doar reutilizare.
  v_delivery_result := public.set_comanda_delivered(p_comanda_id, null, 'platit');
  v_delivered_order := v_delivery_result -> 'delivered_order';

  insert into public.comenzi (
    tenant_id,
    client_id,
    client_nume_manual,
    telefon,
    locatie_livrare,
    data_comanda,
    data_livrare,
    cantitate_kg,
    pret_per_kg,
    total,
    order_kind,
    status,
    parent_comanda_id,
    produs_id
  )
  values (
    v_tenant_id,
    nullif(v_delivered_order ->> 'client_id', '')::uuid,
    v_delivered_order ->> 'client_nume_manual',
    v_delivered_order ->> 'telefon',
    v_delivered_order ->> 'locatie_livrare',
    public.bucharest_today(),
    p_new_data_livrare,
    round(p_new_cantitate_kg::numeric, 2),
    round(coalesce((v_delivered_order ->> 'pret_per_kg')::numeric, 0), 2),
    round((p_new_cantitate_kg * coalesce((v_delivered_order ->> 'pret_per_kg')::numeric, 0))::numeric, 2),
    'manual',
    'programata',
    p_comanda_id,
    nullif(v_delivered_order ->> 'produs_id', '')::uuid
  )
  returning *
  into v_new_order;

  return jsonb_build_object(
    'delivered_order', v_delivered_order,
    'vanzare', v_delivery_result -> 'vanzare',
    'new_order', to_jsonb(v_new_order)
  );
end;
$$;

grant execute on function public.deliver_and_clone_comanda(uuid, numeric, date) to authenticated, service_role;

notify pgrst, 'reload schema';
