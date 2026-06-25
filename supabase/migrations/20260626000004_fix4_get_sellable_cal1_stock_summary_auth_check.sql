-- Fix 4: adaugă verificare auth.uid() IS NULL pe get_sellable_cal1_stock_summary
-- pentru a bloca accesul anonim.

CREATE OR REPLACE FUNCTION public.get_sellable_cal1_stock_summary(
  p_tenant_id uuid DEFAULT NULL
)
RETURNS TABLE (
  recoltat_cal1_kg              numeric,
  consumat_definitiv_cal1_kg    numeric,
  rezervat_activ_cal1_kg        numeric,
  legacy_in_livrare_fara_rezervare_kg numeric,
  stoc_cal1_ledger_kg           numeric,
  disponibil_cal1_kg            numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_recoltat  numeric := 0;
  v_consumat  numeric := 0;
  v_rezervat  numeric := 0;
  v_legacy_manual numeric := 0;
  v_legacy_shop   numeric := 0;
  v_legacy_total  numeric := 0;
  v_disponibil    numeric := 0;
  v_ledger        numeric := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  SELECT coalesce(p_tenant_id, public.current_tenant_id())
  INTO v_tenant_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant invalid pentru utilizatorul curent.';
  END IF;

  SELECT round(coalesce(sum(ms.cantitate_kg), 0)::numeric, 2)
  INTO v_recoltat
  FROM public.miscari_stoc ms
  WHERE ms.tenant_id = v_tenant_id
    AND ms.calitate = 'cal1'
    AND coalesce(ms.depozit, 'fresh') = 'fresh'
    AND ms.tip_miscare = 'recoltare';

  SELECT round(coalesce(sum(ms.cantitate_kg), 0)::numeric, 2)
  INTO v_consumat
  FROM public.miscari_stoc ms
  WHERE ms.tenant_id = v_tenant_id
    AND ms.calitate = 'cal1'
    AND coalesce(ms.depozit, 'fresh') = 'fresh'
    AND ms.tip_miscare IN ('vanzare', 'consum', 'oferit_gratuit', 'pierdere');

  SELECT round(coalesce(sum(sr.cantitate_kg), 0)::numeric, 2)
  INTO v_rezervat
  FROM public.stock_reservations sr
  WHERE sr.tenant_id = v_tenant_id
    AND sr.status = 'active'
    AND sr.calitate = 'cal1';

  SELECT round(coalesce(sum(bucket.available_kg), 0)::numeric, 2)
  INTO v_disponibil
  FROM public.list_sellable_cal1_buckets_for_reservation(v_tenant_id) AS bucket;

  v_ledger := round((v_disponibil + v_rezervat)::numeric, 2);

  SELECT round(coalesce(sum(c.cantitate_kg), 0)::numeric, 2)
  INTO v_legacy_manual
  FROM public.comenzi c
  WHERE c.tenant_id = v_tenant_id
    AND c.status = 'in_livrare'
    AND NOT EXISTS (
      SELECT 1
      FROM public.stock_reservations sr
      WHERE sr.tenant_id = v_tenant_id
        AND sr.comanda_id = c.id
        AND sr.status = 'active'
    );

  SELECT round(coalesce(sum(public.resolve_shop_order_total_kg_loose(shop_order.items)), 0)::numeric, 2)
  INTO v_legacy_shop
  FROM public.shop_orders shop_order
  WHERE shop_order.tenant_id = v_tenant_id
    AND shop_order.status = 'in_livrare'
    AND NOT EXISTS (
      SELECT 1
      FROM public.stock_reservations sr
      WHERE sr.tenant_id = v_tenant_id
        AND sr.shop_order_id = shop_order.id
        AND sr.status = 'active'
    );

  v_legacy_total := round((v_legacy_manual + v_legacy_shop)::numeric, 2);
  v_disponibil   := round((v_disponibil - v_legacy_total)::numeric, 2);

  RETURN QUERY
  SELECT
    v_recoltat,
    v_consumat,
    v_rezervat,
    v_legacy_total,
    v_ledger,
    v_disponibil;
END;
$$;

REVOKE ALL ON FUNCTION public.get_sellable_cal1_stock_summary(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_sellable_cal1_stock_summary(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_sellable_cal1_stock_summary(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
