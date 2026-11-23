-- Stocul cal. 1 pe cultură (promptul 31): „cultura vine din parcele”.
--
-- NEAPLICATĂ: o rulează Andrei, după merge. Doar aditivă. Cere migrarea 20261121150000 (`cultura_recoltare_stoc`,
-- aplicată în producție: verificat pe 23.11.2026 cu select în `pg_proc`).
--
-- De ce: o fermă cu mai multe culturi (demo „Fructe de pădure”: zmeură + mure + afine) vedea un singur stoc,
-- al zmeurei. Acum aplicația arată stocul pe fiecare cultură (o filă pe cultură în Stocuri), iar comanda scade din
-- cultura ei (prin `comenzi.produs_id`, care există deja: produsul „<Cultură> proaspătă/proaspete”).
--
-- Ce face:
--   1. `ajustari_stoc.cultura` (text, null): cultura ajustării (cheia normalizată din aplicație: „zmeur”, „afin”…).
--      Rândurile vechi rămân `null` și aplicația le dă culturii principale (zmeura dacă ferma are zmeură).
--   2. `stoc_cal1_pe_cultura(p_tenant_id)`: rândurile din care aplicația socotește stocul pe cultură
--      (`src/lib/stocuri/pe-cultura.ts`, cu teste): recoltările pe cultura lor (`cultura_recoltare_stoc`),
--      comenzile livrate / în livrare pe numele produsului lor, comenzile magazinului nepromovate (fără cultură)
--      și ajustările pe cultura lor. Aceleași surse și aceleași filtre ca `get_sellable_cal1_stock_summary`.
--      Normalizarea („Zmeure Delniwa” = „Zmeură”) se face în aplicație, într-o singură funcție testată.
--   3. `create_ajustare_stoc` primește `p_cultura text default null` și o scrie în rând. Garda de stoc rămâne cea
--      de azi (`get_sellable_cal1_stock_summary`) pentru o ajustare fără cultură, de zmeură sau într-o fermă fără
--      zmeură; o ajustare pe altă cultură într-o fermă cu zmeură se verifică în formular, pe cultura ei.
--   4. `get_sellable_cal1_stock_summary`: când ferma are zmeură, comenzile cu produsul altei culturi și ajustările
--      altei culturi nu mai scad din stocul zmeurei. Ferma lui Andrei: același rezultat (verificat cu select pe
--      23.11.2026: comenzile au produsul „Zmeură proaspătă” sau niciunul; ajustările nu au cultură).
--
-- Fără migrare: aplicația merge ca azi (o singură cifră, din `get_sellable_cal1_stock_summary`), cu eticheta luată
-- din cultura parcelelor. O fermă cu o singură cultură (ferma lui Andrei) folosește oricum sumarul de azi.
--
-- Anulare:
--   drop function if exists public.stoc_cal1_pe_cultura(uuid);
--   drop function if exists public.create_ajustare_stoc(text, numeric, text, date, uuid, text);
--   -- și se rulează din nou definiția de azi a `create_ajustare_stoc` (5 parametri, din 20261121190000);
--   -- și definiția `get_sellable_cal1_stock_summary` din 20261121150000;
--   alter table public.ajustari_stoc drop column if exists cultura;

-- 1. Cultura ajustării ---------------------------------------------------------------------------------------------

alter table public.ajustari_stoc add column if not exists cultura text;

comment on column public.ajustari_stoc.cultura is
  'Cultura ajustării (cheia normalizată din aplicație, ex. zmeur, afin). Null = rând vechi: cultura principală a fermei.';

-- 2. Rândurile stocului pe cultură -----------------------------------------------------------------------------------

create or replace function public.stoc_cal1_pe_cultura(p_tenant_id uuid default null::uuid)
returns table(sursa text, cultura text, kg numeric)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
  v_current_tenant_id uuid;
  v_tenant_id uuid;
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

  return query
  -- Recoltat cal. 1, pe cultura recoltării (alegerea din recoltare, apoi cultura parcelei).
  select 'recoltat'::text,
         rc.cultura,
         round(coalesce(sum(rc.kg_cal1), 0)::numeric, 2)
  from (
    select r.kg_cal1, public.cultura_recoltare_stoc(r.observatii, r.parcela_id, v_tenant_id) as cultura
    from public.recoltari r
    where r.tenant_id = v_tenant_id
  ) rc
  group by rc.cultura

  union all
  -- Comenzile livrate și cele în livrare, pe numele produsului (null = comandă fără produs).
  select case when c.status = 'livrata' then 'livrat' else 'in_livrare' end,
         p.nume,
         round(coalesce(sum(c.cantitate_kg), 0)::numeric, 2)
  from public.comenzi c
  left join public.produse p on p.id = c.produs_id and p.tenant_id = v_tenant_id
  where c.tenant_id = v_tenant_id
    and c.status in ('livrata', 'in_livrare')
  group by 1, p.nume

  union all
  -- Comenzile magazinului încă nepromovate în `comenzi` (fără cultură: merg la cultura principală).
  select case when s.status = 'livrata' then 'livrat' else 'in_livrare' end,
         null::text,
         round(coalesce(sum(public.resolve_shop_order_total_kg_loose(s.items)), 0)::numeric, 2)
  from public.shop_orders s
  where s.tenant_id = v_tenant_id
    and s.status in ('livrata', 'in_livrare')
    and not exists (
      select 1
      from public.shop_order_erp_links link
      where link.tenant_id = v_tenant_id
        and link.shop_order_id = s.id
    )
  group by 1

  union all
  -- Ajustările, pe cultura lor (null = rând vechi).
  select 'ajustare'::text,
         a.cultura,
         round(coalesce(sum(a.delta_kg), 0)::numeric, 2)
  from public.ajustari_stoc a
  where a.tenant_id = v_tenant_id
  group by a.cultura;
end;
$function$;

revoke execute on function public.stoc_cal1_pe_cultura(uuid) from public, anon;
grant execute on function public.stoc_cal1_pe_cultura(uuid) to authenticated, service_role;

-- 3. Ajustarea cu cultura ---------------------------------------------------------------------------------------------
-- Corpul din producție pe 23.11.2026 (`pg_get_functiondef`), cu o singură schimbare: parametrul `p_cultura`, scris
-- în rând. Semnătura veche se șterge, ca PostgREST să nu aibă două funcții cu același nume: apelurile fără
-- `p_cultura` merg mai departe (parametrul are valoare implicită).

drop function if exists public.create_ajustare_stoc(text, numeric, text, date, uuid);

create or replace function public.create_ajustare_stoc(
  p_tip text,
  p_delta_kg numeric,
  p_motiv text default null::text,
  p_data date default null::date,
  p_client_sync_id uuid default null::uuid,
  p_cultura text default null::text
)
returns ajustari_stoc
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_delta numeric := round(coalesce(p_delta_kg, 0)::numeric, 2);
  v_summary record;
  v_available numeric;
  v_row public.ajustari_stoc;
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

  if p_tip is null or p_tip not in ('congelat', 'procesat', 'pierdere', 'consum_propriu', 'corectie_plus', 'corectie_minus', 'altul') then
    raise exception 'Tip ajustare invalid.';
  end if;

  if v_delta = 0 then
    raise exception 'Cantitatea ajustării trebuie să fie diferită de 0.';
  end if;

  if p_tip = 'corectie_plus' and v_delta <= 0 then
    raise exception 'Ajustarea de tip corectie_plus trebuie să aibă cantitate pozitivă.';
  end if;

  if p_tip <> 'corectie_plus' and v_delta >= 0 then
    raise exception 'Ajustarea de tip % este o scădere: cantitatea trebuie să fie negativă.', p_tip;
  end if;

  perform pg_advisory_xact_lock(hashtext('stock-mutation'), hashtext(v_tenant_id::text));

  if p_client_sync_id is not null then
    select *
    into v_row
    from public.ajustari_stoc
    where tenant_id = v_tenant_id
      and client_sync_id = p_client_sync_id;

    if found then
      return v_row;
    end if;
  end if;

  -- Garda pe sumarul de azi, când el e stocul culturii ajustate: ajustare fără cultură, ajustare de zmeură, sau o
  -- fermă fără zmeură (sumarul numără atunci toate culturile). O ajustare pe altă cultură, într-o fermă cu zmeură,
  -- nu se compară cu stocul zmeurei: formularul o verifică pe cultura ei.
  if v_delta < 0
     and (
       p_cultura is null
       or btrim(p_cultura) = ''
       or translate(lower(btrim(p_cultura)), 'ăâîșşțţ', 'aaissttt') like 'zmeur%'
       or not exists (
         select 1
         from public.recoltari r
         where r.tenant_id = v_tenant_id
           and public.cultura_recoltare_stoc(r.observatii, r.parcela_id, v_tenant_id) like 'zmeur%'
       )
     ) then
    select *
    into v_summary
    from public.get_sellable_cal1_stock_summary(v_tenant_id);

    v_available := round(coalesce(v_summary.disponibil_cal1_kg, 0)::numeric, 2);

    if v_available + v_delta < 0 then
      raise exception 'STOC_INSUFICIENT'
        using
          detail = format('necesar=%s;disponibil=%s', abs(v_delta), v_available),
          errcode = 'P0001';
    end if;
  end if;

  insert into public.ajustari_stoc (
    tenant_id,
    data,
    delta_kg,
    tip,
    motiv,
    created_by,
    client_sync_id,
    cultura
  )
  values (
    v_tenant_id,
    coalesce(p_data, public.bucharest_today()),
    v_delta,
    p_tip,
    nullif(btrim(coalesce(p_motiv, '')), ''),
    v_user_id,
    p_client_sync_id,
    nullif(btrim(coalesce(p_cultura, '')), '')
  )
  returning *
  into v_row;

  return v_row;
end;
$function$;

revoke execute on function public.create_ajustare_stoc(text, numeric, text, date, uuid, text) from public, anon;
grant execute on function public.create_ajustare_stoc(text, numeric, text, date, uuid, text) to authenticated, service_role;

-- 4. Sumarul de azi, aliniat cu stocul pe cultură ---------------------------------------------------------------------
-- Corpul din producție pe 23.11.2026 (cel din 20261121150000; verificat cu `pg_get_functiondef`), cu o singură
-- schimbare: când ferma are zmeură (deci sumarul e stocul zmeurei), comenzile și ajustările altor culturi nu mai
-- scad din el. O comandă fără produs sau cu un produs de zmeură, o ajustare fără cultură sau de zmeură, și comenzile
-- magazinului se numără ca până acum. Ferma lui Andrei (o cultură, comenzile fără produs sau cu „Zmeură proaspătă”,
-- ajustările fără cultură) are exact același rezultat. O fermă fără zmeură numără tot, ca până acum.
-- Semnătura, coloanele întoarse și drepturile rămân aceleași.

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

  -- Comenzile: la o fermă cu zmeură, doar cele fără produs sau cu un produs de zmeură.
  select
    round(coalesce(sum(c.cantitate_kg) filter (where c.status = 'livrata'), 0)::numeric, 2),
    round(coalesce(sum(c.cantitate_kg) filter (where c.status = 'in_livrare'), 0)::numeric, 2)
  into v_livrat_comenzi, v_in_livrare_comenzi
  from public.comenzi c
  left join public.produse p on p.id = c.produs_id and p.tenant_id = v_tenant_id
  where c.tenant_id = v_tenant_id
    and c.status in ('livrata', 'in_livrare')
    and (
      not v_are_zmeura
      or p.id is null
      or translate(lower(btrim(coalesce(p.nume, ''))), 'ăâîșşțţ', 'aaissttt') like 'zmeur%'
    );

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

  -- Ajustările: la o fermă cu zmeură, doar cele fără cultură sau de zmeură.
  select round(coalesce(sum(a.delta_kg), 0)::numeric, 2)
  into v_ajustari
  from public.ajustari_stoc a
  where a.tenant_id = v_tenant_id
    and (
      not v_are_zmeura
      or a.cultura is null
      or translate(lower(btrim(a.cultura)), 'ăâîșşțţ', 'aaissttt') like 'zmeur%'
    );

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
