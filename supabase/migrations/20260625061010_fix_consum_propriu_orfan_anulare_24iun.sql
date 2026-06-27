
BEGIN;

-- 1. Eliberează rezervarea (released, nu consumed — comanda se anulează)
UPDATE stock_reservations
SET status = 'released',
    released_at = '2026-06-24 21:20:00+00'
WHERE id = 'e79e63ac-bf81-44f2-9e9b-adffc2b4a3dd'
  AND tenant_id = '99485d6b-f186-49db-a379-bb9a12d34968';

-- 2. Anulează comanda (tranziție permisă din in_livrare)
UPDATE comenzi
SET status = 'anulata',
    updated_at = now()
WHERE id = '90526571-dff4-4cfa-951d-baf221cf2aee'
  AND tenant_id = '99485d6b-f186-49db-a379-bb9a12d34968';

COMMIT;
;
