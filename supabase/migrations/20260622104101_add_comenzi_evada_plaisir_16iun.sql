
-- Vânzare Evada 2.5 kg
WITH v_evada AS (
  INSERT INTO vanzari (id, tenant_id, id_vanzare, cantitate_kg, pret_lei_kg, data, status_plata)
  VALUES (gen_random_uuid(), '99485d6b-f186-49db-a379-bb9a12d34968', 'V5225', 2.5, 35, '2026-06-16', 'platit')
  RETURNING id
),
c_evada AS (
  INSERT INTO comenzi (id, tenant_id, client_nume_manual, cantitate_kg, pret_per_kg, total, status, data_comanda, data_livrare, stock_deducted, linked_vanzare_id)
  SELECT gen_random_uuid(), '99485d6b-f186-49db-a379-bb9a12d34968', 'Evada', 2.5, 35, 87.5, 'livrata', '2026-06-16', '2026-06-16', true, id
  FROM v_evada
  RETURNING linked_vanzare_id
)
INSERT INTO miscari_stoc (id, tenant_id, tip, tip_miscare, cantitate_kg, data, referinta_id, observatii)
SELECT gen_random_uuid(), '99485d6b-f186-49db-a379-bb9a12d34968', 'vanzare', 'vanzare', 2.5, '2026-06-16', linked_vanzare_id, 'Consum stoc prin livrare comanda'
FROM c_evada;

-- Vânzare Plaisir 5 kg
WITH v_plaisir AS (
  INSERT INTO vanzari (id, tenant_id, id_vanzare, cantitate_kg, pret_lei_kg, data, status_plata)
  VALUES (gen_random_uuid(), '99485d6b-f186-49db-a379-bb9a12d34968', 'V5226', 5, 35, '2026-06-16', 'platit')
  RETURNING id
),
c_plaisir AS (
  INSERT INTO comenzi (id, tenant_id, client_nume_manual, cantitate_kg, pret_per_kg, total, status, data_comanda, data_livrare, stock_deducted, linked_vanzare_id)
  SELECT gen_random_uuid(), '99485d6b-f186-49db-a379-bb9a12d34968', 'Plaisir', 5, 35, 175, 'livrata', '2026-06-16', '2026-06-16', true, id
  FROM v_plaisir
  RETURNING linked_vanzare_id
)
INSERT INTO miscari_stoc (id, tenant_id, tip, tip_miscare, cantitate_kg, data, referinta_id, observatii)
SELECT gen_random_uuid(), '99485d6b-f186-49db-a379-bb9a12d34968', 'vanzare', 'vanzare', 5, '2026-06-16', linked_vanzare_id, 'Consum stoc prin livrare comanda'
FROM c_plaisir;
;
