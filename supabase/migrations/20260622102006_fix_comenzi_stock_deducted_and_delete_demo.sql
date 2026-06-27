
-- 1. Fix flag stock_deducted pe comenzile reale din iunie
UPDATE comenzi
SET stock_deducted = true
WHERE status = 'livrata'
  AND stock_deducted = false
  AND demo_seed_id IS NULL;

-- 2. Șterge comenzile demo (toate au demo_seed_id != null)
DELETE FROM comenzi
WHERE demo_seed_id IS NOT NULL;
;
