-- MIGRARE DE DATE (R2 cleanup) — 2026-07-11.
-- Anulează comenzile bridge rămase blocate în 'in_livrare' după ce shop order-ul
-- asociat a fost anulat (bug-ul R2 confirmat pe producție: 3 comenzi, 1+2+2 = 5,00 kg
-- de stoc fantomă angajat permanent).
--
-- Este un UPDATE de status pe rânduri bridge DERIVATE (create automat de
-- promote_shop_order_to_comanda), nu pe date introduse manual de utilizator.
-- Identificare strictă prin JOIN comenzi <- shop_order_erp_links -> shop_orders,
-- unde shop_orders.status = 'anulata' și comenzi.status = 'in_livrare'.
-- Se așteaptă EXACT 3 rânduri; dacă numărul diferă, migrarea eșuează și se
-- revine (rollback) pentru inspecție manuală. NU se șterge nimic.

do $$
declare
  v_tenant_id constant uuid := '99485d6b-f186-49db-a379-bb9a12d34968';
  v_expected constant integer := 3;
  v_count integer;
begin
  with phantom as (
    select c.id
    from public.comenzi c
    join public.shop_order_erp_links l
      on l.comanda_id = c.id
     and l.tenant_id = c.tenant_id
    join public.shop_orders so
      on so.id = l.shop_order_id
    where c.tenant_id = v_tenant_id
      and c.status = 'in_livrare'
      and so.status = 'anulata'
  )
  update public.comenzi c
  set status = 'anulata',
      observatii = concat_ws(
        ' | ',
        nullif(btrim(coalesce(c.observatii, '')), ''),
        'Anulată automat: shop order anulat (reconciliere R2, 2026-07-11)'
      ),
      updated_at = now()
  where c.id in (select id from phantom);

  get diagnostics v_count = row_count;
  raise notice 'R2 cleanup: % comenzi bridge trecute pe anulata (așteptat: %).', v_count, v_expected;

  if v_count <> v_expected then
    raise exception 'R2 cleanup: am găsit % comenzi fantomă în loc de % — rollback pentru inspecție manuală.',
      v_count, v_expected;
  end if;
end
$$;
