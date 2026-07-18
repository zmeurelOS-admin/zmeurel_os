-- NEVER delete, truncate, or modify any user data in the database. Do not run DELETE, UPDATE, or TRUNCATE on production data tables. Do not reset or seed over existing data.
-- Auto-bridges new shop_orders rows into comenzi so they show up in the Comenzi module without manual intervention.

CREATE OR REPLACE FUNCTION bridge_shop_order_to_comenzi()
RETURNS TRIGGER AS $$
DECLARE
  v_total_kg numeric := 0;
  v_produs_id uuid;
  v_pret_per_kg numeric;
  v_existing_client_id uuid;
BEGIN
  -- Sum kg across items (assumes 500g caserola for the "zmeura" product; falls back gracefully otherwise)
  SELECT COALESCE(SUM((item->>'qty')::numeric * 0.5), 0)
  INTO v_total_kg
  FROM jsonb_array_elements(COALESCE(NEW.items, '[]'::jsonb)) AS item
  WHERE item->>'vid' = 'zmeura';

  -- If no zmeura items matched (different/unknown product), fall back to total/35 as an estimate
  IF v_total_kg = 0 THEN
    v_total_kg := NULL;
  END IF;

  v_produs_id := '6dd4207f-e9a5-46a1-bab7-1ab1d1d6d5b5';

  IF v_total_kg IS NOT NULL AND v_total_kg > 0 THEN
    v_pret_per_kg := ROUND(NEW.total_lei / v_total_kg, 2);
  ELSE
    v_pret_per_kg := NULL;
  END IF;

  -- Try to match an existing client by phone to link client_id (best-effort, non-blocking)
  SELECT id INTO v_existing_client_id
  FROM clienti
  WHERE telefon = NEW.customer_phone
    AND tenant_id = NEW.tenant_id
  LIMIT 1;

  INSERT INTO comenzi (
    tenant_id, client_id, client_nume_manual, telefon, locatie_livrare,
    data_comanda, data_livrare, cantitate_kg, pret_per_kg, total, status,
    observatii, produs_id, cost_livrare, data_origin, order_kind
  )
  VALUES (
    NEW.tenant_id,
    v_existing_client_id,
    CASE WHEN v_existing_client_id IS NULL THEN NEW.customer_name ELSE NULL END,
    NEW.customer_phone,
    COALESCE(NEW.delivery_address, NEW.delivery_city),
    NEW.created_at::date,
    COALESCE(NEW.delivery_date, NEW.created_at::date),
    v_total_kg,
    v_pret_per_kg,
    NEW.total_lei,
    'noua',
    'Comandă shop ' || NEW.id::text,
    v_produs_id,
    0.00,
    'shop_order_bridge',
    'manual'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_bridge_shop_order_to_comenzi
AFTER INSERT ON shop_orders
FOR EACH ROW
EXECUTE FUNCTION bridge_shop_order_to_comenzi();
