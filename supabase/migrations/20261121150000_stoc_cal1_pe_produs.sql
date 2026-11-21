-- Stocul cal. 1 derivat, socotit pe produsul vândut (zmeura), nu pe toate culturile.
--
-- NEAPLICATĂ: o rulează Andrei, după merge. Independentă de celelalte migrări din 21.11; după
-- 20261121110000 (garda comenzilor) doar ca ordine recomandată, fiindcă și garda citește stocul.
--
-- Înainte: `get_sellable_cal1_stock_summary` aduna `kg_cal1` din TOATE recoltările fermei. O fermă cu
-- zmeură și mure (de exemplu ferma demo „Fructe de pădure”) vedea murele în stocul de zmeură pe care îl
-- vinde prin Comenzi / Livrări / Vânzare rapidă.
--
-- Acum: recoltările se filtrează pe cultura lor, prin legătura recoltare → produs care există deja,
-- `resolve_recoltare_stock_identity(parcela_id, observatii, tenant_id)` (alegerea culturii din recoltare,
-- `[zmeurel:harvest-crop]`, apoi prima cultură a parcelei, apoi `parcele.cultura` / `tip_fruct`):
--   * dacă ferma are cel puțin o recoltare de zmeură (cultura, fără diacritice și majuscule, începe cu
--     „zmeur”: „Zmeură”, „zmeura”, „Zmeure Delniwa”…), stocul numără doar recoltările de zmeură;
--   * altfel (ferma nu are deloc zmeură: solarii, cereale), stocul rămâne ca înainte, din toate recoltările.
-- O fermă cu o singură cultură are același rezultat ca înainte: fie toate recoltările sunt de zmeură, fie
-- niciuna. Ferma lui Andrei are azi o singură cultură (zmeură; verificat pe 21.11.2026 cu select).
-- Comenzile (livrate / în livrare), comenzile magazinului și ajustările nu se filtrează: ele sunt deja
-- ale produsului vândut.
--
-- `cultura_recoltare_stoc` (nouă): învelește `resolve_recoltare_stock_identity` și întoarce cultura
-- normalizată; o parcelă lipsă sau o etichetă stricată dau `null` (recoltarea nu e numărată ca zmeură),
-- nu opresc tot calculul stocului. SECURITY DEFINER, EXECUTE doar pentru service_role: o cheamă doar
-- `get_sellable_cal1_stock_summary` (care rulează ca proprietarul funcției).
--
-- `get_sellable_cal1_stock_summary`: corpul din producție pe 21.11.2026 (`pg_get_functiondef`), cu o
-- singură schimbare: blocul care socotește `v_recoltat`. Semnătura, coloanele întoarse și drepturile
-- rămân aceleași.
--
-- Anulare: se rulează din nou definiția din producție de dinainte (`v_recoltat` = suma tuturor recoltărilor);
--   drop function if exists public.cultura_recoltare_stoc(text, uuid, uuid);

create or replace function public.cultura_recoltare_stoc(
  p_observatii text,
  p_parcela_id uuid,
  p_tenant_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_identity jsonb;
begin
  if p_parcela_id is null or p_tenant_id is null then
    return null;
  end if;

  begin
    v_identity := public.resolve_recoltare_stock_identity(p_parcela_id, p_observatii, p_tenant_id);
  exception
    when others then
      return null;
  end;

  return nullif(
    translate(lower(btrim(coalesce(v_identity ->> 'cultura', ''))), 'ăâîșşțţ', 'aaissttt'),
    ''
  );
end;
$function$;

revoke execute on function public.cultura_recoltare_stoc(text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.cultura_recoltare_stoc(text, uuid, uuid) to service_role;

create or replace function public.get_sellable_cal1_stock_summary(p_tenant_id uuid default null::uuid)
returns table(
  recoltat_cal1_kg numeric,
  consumat_definitiv_cal1_kg numeric,
  rezervat_activ_cal1_kg numeric,
  legacy_in_livrare_fara_rezervare_kg numeric,
  stoc_cal1_ledger_kg numeric,
  disponibil_cal1_kg numeric
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
  v_current_tenant_id uuid;
  v_tenant_id uuid;
  v_recoltat numeric := 0;
  v_recoltat_toate numeric := 0;
  v_recoltat_zmeura numeric := 0;
  v_are_zmeura boolean := false;
  v_livrat_comenzi numeric := 0;
  v_livrat_shop_nepromovat numeric := 0;
  v_in_livrare_comenzi numeric := 0;
  v_in_livrare_shop_nepromovat numeric := 0;
  v_ajustari numeric := 0;
  v_consumat numeric := 0;
  v_angajat numeric := 0;
  v_ledger numeric := 0;
  v_disponibil numeric := 0;
begin
  if auth.uid() is null and v_role <> 'service_role' then
    raise exception 'UNAUTHORIZED';
  end if;

  select public.current_tenant_id()
  into v_current_tenant_id;

  v_tenant_id := coalesce(p_tenant_id, v_current_tenant_id);

  if v_tenant_id is null then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  if v_role <> 'service_role'
     and (v_current_tenant_id is null or v_current_tenant_id <> v_tenant_id) then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  -- Recoltat, pe produsul vândut: doar zmeura, dacă ferma are zmeură; altfel toate recoltările.
  with rc as (
    select r.kg_cal1, public.cultura_recoltare_stoc(r.observatii, r.parcela_id, v_tenant_id) as cultura
    from public.recoltari r
    where r.tenant_id = v_tenant_id
  )
  select
    round(coalesce(sum(rc.kg_cal1), 0)::numeric, 2),
    round(coalesce(sum(rc.kg_cal1) filter (where rc.cultura like 'zmeur%'), 0)::numeric, 2),
    coalesce(bool_or(rc.cultura like 'zmeur%'), false)
  into v_recoltat_toate, v_recoltat_zmeura, v_are_zmeura
  from rc;

  v_recoltat := case when v_are_zmeura then v_recoltat_zmeura else v_recoltat_toate end;

  select round(coalesce(sum(c.cantitate_kg), 0)::numeric, 2)
  into v_livrat_comenzi
  from public.comenzi c
  where c.tenant_id = v_tenant_id
    and c.status = 'livrata';

  select round(coalesce(sum(c.cantitate_kg), 0)::numeric, 2)
  into v_in_livrare_comenzi
  from public.comenzi c
  where c.tenant_id = v_tenant_id
    and c.status = 'in_livrare';

  select round(coalesce(sum(public.resolve_shop_order_total_kg_loose(shop_order.items)), 0)::numeric, 2)
  into v_livrat_shop_nepromovat
  from public.shop_orders shop_order
  where shop_order.tenant_id = v_tenant_id
    and shop_order.status = 'livrata'
    and not exists (
      select 1
      from public.shop_order_erp_links link
      where link.tenant_id = v_tenant_id
        and link.shop_order_id = shop_order.id
    );

  select round(coalesce(sum(public.resolve_shop_order_total_kg_loose(shop_order.items)), 0)::numeric, 2)
  into v_in_livrare_shop_nepromovat
  from public.shop_orders shop_order
  where shop_order.tenant_id = v_tenant_id
    and shop_order.status = 'in_livrare'
    and not exists (
      select 1
      from public.shop_order_erp_links link
      where link.tenant_id = v_tenant_id
        and link.shop_order_id = shop_order.id
    );

  select round(coalesce(sum(a.delta_kg), 0)::numeric, 2)
  into v_ajustari
  from public.ajustari_stoc a
  where a.tenant_id = v_tenant_id;

  v_consumat := round((v_livrat_comenzi + v_livrat_shop_nepromovat)::numeric, 2);
  v_angajat := round((v_in_livrare_comenzi + v_in_livrare_shop_nepromovat)::numeric, 2);
  v_ledger := round((v_recoltat - v_consumat + v_ajustari)::numeric, 2);
  v_disponibil := round((v_ledger - v_angajat)::numeric, 2);

  return query
  select
    v_recoltat,
    v_consumat,
    v_angajat,
    0::numeric,
    v_ledger,
    v_disponibil;
end;
$function$;

revoke execute on function public.get_sellable_cal1_stock_summary(uuid) from public, anon;
grant execute on function public.get_sellable_cal1_stock_summary(uuid) to authenticated, service_role;
