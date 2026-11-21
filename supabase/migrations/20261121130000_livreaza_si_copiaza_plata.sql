-- Livrări: „Livrează și copiază” cu aceleași opțiuni de plată ca livrarea normală.
--
-- NEAPLICATĂ: o rulează Andrei, după merge. Se aplică după 20261121120000 (folosește
-- `adauga_plata_vanzare`).
--
-- Înainte: `deliver_and_clone_comanda` chema `set_comanda_delivered(..., 'platit')`, deci vânzarea
-- comenzii livrate ieșea mereu încasată, chiar dacă clientul n-a plătit sau a dat doar un avans.
--
-- Acum: funcția NOUĂ `livreaza_si_copiaza_comanda` primește plata, ca livrarea normală:
--   * `p_status_plata = 'platit'`  → încasat tot (ca înainte);
--   * `p_status_plata = 'neplatit'` și `p_suma_primita_lei > 0` → avans: vânzarea rămâne neîncasată,
--     iar suma se adună prin `adauga_plata_vanzare` (aceeași regulă și aceeași cheie de idempotență);
--     dacă avansul acoperă tot, vânzarea devine încasată;
--   * `p_status_plata = 'neplatit'` fără sumă → neîncasat.
-- Restul e identic cu `deliver_and_clone_comanda` (corpul din producție pe 21.11.2026): doar comenzile
-- `in_livrare`, livrare integrală, comanda nouă `programata` pe ziua aleasă, cu același preț.
-- Totul într-o singură tranzacție: dacă avansul e refuzat, nu rămâne nici livrarea, nici copia.
--
-- De ce o funcție nouă și nu un parametru în plus la `deliver_and_clone_comanda`: cu valori implicite,
-- apelul cu 3 argumente al aplicației din producție ar potrivi două supraîncărcări (PGRST203). Funcția
-- veche rămâne neschimbată; aplicația o folosește în continuare pentru „încasat tot”.
--
-- Aditivă: o funcție nouă.
--
-- Anulare: drop function if exists public.livreaza_si_copiaza_comanda(uuid, numeric, date, text, numeric, uuid);

create or replace function public.livreaza_si_copiaza_comanda(
  p_comanda_id uuid,
  p_new_cantitate_kg numeric,
  p_new_data_livrare date,
  p_status_plata text,
  p_suma_primita_lei numeric default null,
  p_plata_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_order public.comenzi;
  v_delivery_result jsonb;
  v_delivered_order jsonb;
  v_sale_id uuid;
  v_sale public.vanzari;
  v_new_order public.comenzi;
  v_suma numeric := round(coalesce(p_suma_primita_lei, 0)::numeric, 2);
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

  if p_status_plata is null or p_status_plata not in ('platit', 'neplatit') then
    raise exception 'Status plată invalid.';
  end if;

  if v_suma < 0 then
    raise exception 'Suma primită nu poate fi negativă.';
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

  v_delivery_result := public.set_comanda_delivered(p_comanda_id, null, p_status_plata);
  v_delivered_order := v_delivery_result -> 'delivered_order';
  v_sale_id := nullif(v_delivery_result -> 'vanzare' ->> 'id', '')::uuid;

  -- Avansul: se adună la vânzarea abia creată, prin aceeași funcție ca orice plată parțială.
  if p_status_plata = 'neplatit' and v_suma > 0 and v_sale_id is not null then
    v_sale := public.adauga_plata_vanzare(v_sale_id, v_suma, public.bucharest_today(), coalesce(p_plata_id, gen_random_uuid()));
  else
    select * into v_sale from public.vanzari where id = v_sale_id and tenant_id = v_tenant_id;
  end if;

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
    'vanzare', to_jsonb(v_sale),
    'new_order', to_jsonb(v_new_order)
  );
end;
$function$;

revoke execute on function public.livreaza_si_copiaza_comanda(uuid, numeric, date, text, numeric, uuid) from public, anon;
grant execute on function public.livreaza_si_copiaza_comanda(uuid, numeric, date, text, numeric, uuid) to authenticated, service_role;
