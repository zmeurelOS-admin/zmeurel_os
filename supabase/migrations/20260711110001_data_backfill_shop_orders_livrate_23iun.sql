-- MIGRARE DE DATE (istoric 23 iunie) — 2026-07-11 (rev. 2).
-- Creează retroactiv în `comenzi` cele 6 comenzi shop livrate pe 23 iunie 2026
-- care nu au fost niciodată promovate (fără rând în shop_order_erp_links),
-- împreună cu link-urile ERP corespunzătoare. DOAR INSERT-uri — nu modifică
-- shop_orders și nu șterge nimic.
--
-- Compoziția reală a celor 6 (verificat pe producție 2026-07-11):
--   * 4 vânzări reale (order_kind='manual', 40/80/200/200 lei)
--   * 1 consum propriu (order_kind='consum_propriu', total_lei=0, 0,5 kg)
--   * 1 cadou (order_kind='cadou', total_lei=0, 1,0 kg)
-- De aceea:
--   * validarea de preț acceptă total_lei >= 0 (pret_per_kg=0 pentru gratuite;
--     constraint-ul live pe comenzi este pret_per_kg >= 0 și total >= 0);
--     greutatea rămâne obligatoriu > 0 — toate cele 6 sunt stoc real plecat fizic;
--   * order_kind se propagă din shop_orders în comenzi ('cadou' și
--     'consum_propriu' se păstrează ca atare, ca să nu apară drept vânzări
--     normale în rapoarte; orice altă valoare — 'manual', 'standard',
--     'preorder', NULL — se normalizează la 'manual', setul suportat de comenzi).
--
-- Neutralitate pe stoc (efect net ZERO pe disponibil, garantat de formula
-- get_sellable_cal1_stock_summary):
--   ÎNAINTE: cele 6 comenzi sunt contate în v_livrat_shop_nepromovat
--            (shop_orders livrate FĂRĂ link ERP), prin resolve_shop_order_total_kg_loose.
--   DUPĂ:    au link ERP, deci ies din termenul "nepromovat" și intră în
--            v_livrat_comenzi cu EXACT aceeași cantitate (cantitate_kg este
--            calculată cu aceeași funcție resolve_shop_order_total_kg_loose).
--
-- NU se creează vânzări pentru ele (linked_vanzare_id rămâne NULL):
--   * stocul nu trece prin vanzari (sumarul derivat citește doar comenzi), deci
--     lipsa vânzării nu afectează disponibilul;
--   * crearea de vânzări retroactive ar adăuga venituri noi în rapoartele
--     financiare pentru încasări care nu au fost înregistrate atunci — decizie
--     ce aparține owner-ului, nu migrării (iar pentru cadou/consum propriu nici
--     nu există venit);
--   * set_comanda_delivered (redefinit în 20260711100000) tratează idempotent
--     comenzile cu status 'livrata' fără vânzare legată, deci nu există risc de
--     dublă livrare/dublă deducere.
--
-- Se așteaptă EXACT 6 comenzi și EXACT 14.50 kg total; altfel migrarea eșuează
-- (rollback) pentru inspecție manuală.

do $$
declare
  v_tenant_id constant uuid := '99485d6b-f186-49db-a379-bb9a12d34968';
  v_expected_count constant integer := 6;
  v_expected_kg constant numeric := 14.50;
  v_fallback_date constant date := date '2026-06-23';
  r record;
  v_comanda_id uuid;
  v_total_kg numeric;
  v_price_per_kg numeric;
  v_order_kind text;
  v_produs_id uuid;
  v_count integer := 0;
  v_kg_sum numeric := 0;
begin
  v_produs_id := public.resolve_zmeura_produs_id(v_tenant_id);

  for r in
    select so.*
    from public.shop_orders so
    where so.tenant_id = v_tenant_id
      and so.status = 'livrata'
      and not exists (
        select 1
        from public.shop_order_erp_links l
        where l.shop_order_id = so.id
      )
    order by so.created_at asc
  loop
    v_total_kg := public.resolve_shop_order_total_kg_loose(r.items);

    -- Greutatea trebuie să fie pozitivă (stoc real plecat); valoarea poate fi 0
    -- (consum propriu / cadou), dar nu negativă.
    if v_total_kg is null or v_total_kg <= 0 or coalesce(r.total_lei, 0) < 0 then
      raise exception 'Backfill 23 iun: shop order % are date invalide (kg=%, lei=%) — rollback.',
        r.id, v_total_kg, r.total_lei;
    end if;

    v_price_per_kg := round((coalesce(r.total_lei, 0)::numeric / v_total_kg)::numeric, 2);

    v_order_kind := case
      when r.order_kind in ('cadou', 'consum_propriu') then r.order_kind
      else 'manual'
    end;

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
      observatii,
      data_origin,
      produs_id
    )
    values (
      v_tenant_id,
      null,
      r.customer_name,
      r.customer_phone,
      concat_ws(', ', nullif(btrim(coalesce(r.delivery_address, '')), ''), nullif(btrim(coalesce(r.delivery_city, '')), '')),
      coalesce(r.created_at::date, v_fallback_date),
      coalesce(r.delivery_date, v_fallback_date),
      v_total_kg,
      v_price_per_kg,
      coalesce(r.total_lei, 0),
      v_order_kind,
      'livrata',
      concat_ws(
        ' | ',
        format('Comandă shop %s', r.id),
        nullif(btrim(coalesce(r.notes, '')), ''),
        'Migrare istorică 2026-07-11: livrată 23 iun 2026, nepromovată la momentul livrării (fără vânzare legată)'
      ),
      'shop_order_bridge',
      v_produs_id
    )
    returning id
    into v_comanda_id;

    insert into public.shop_order_erp_links (
      shop_order_id,
      comanda_id,
      tenant_id,
      weight_snapshot
    )
    values (
      r.id,
      v_comanda_id,
      v_tenant_id,
      '[]'::jsonb
    );

    v_count := v_count + 1;
    v_kg_sum := round((v_kg_sum + v_total_kg)::numeric, 2);

    raise notice 'Backfill 23 iun: shop order % -> comanda % (% kg, % lei, order_kind=%).',
      r.id, v_comanda_id, v_total_kg, coalesce(r.total_lei, 0), v_order_kind;
  end loop;

  raise notice 'Backfill 23 iun: % comenzi migrate, % kg total (așteptat: % / % kg).',
    v_count, v_kg_sum, v_expected_count, v_expected_kg;

  if v_count <> v_expected_count or v_kg_sum <> v_expected_kg then
    raise exception 'Backfill 23 iun: am găsit % comenzi / % kg în loc de % / % kg — rollback pentru inspecție manuală.',
      v_count, v_kg_sum, v_expected_count, v_expected_kg;
  end if;
end
$$;
