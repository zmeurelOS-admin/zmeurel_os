-- Eliberare rezervare Elena Pentiuc (comanda livrata, rezervare ramasa activa)
UPDATE stock_reservations
SET status = 'released', released_at = now()
WHERE id = '6be43042-276a-458b-90a2-6272650a5dd0'
  AND tenant_id = '99485d6b-f186-49db-a379-bb9a12d34968';
