
-- 1. Corectez Gabriela: 5kg → 3kg, 200lei → 120lei
UPDATE comenzi SET cantitate_kg = 3, total = 120 
WHERE id = 'b781be35-3920-4225-aefa-66540ad35b0b';

UPDATE vanzari SET cantitate_kg = 3 
WHERE id = 'ed96e9f5-0c74-45a6-bb3f-96630f57cba2';

UPDATE miscari_stoc SET cantitate_kg = 3 
WHERE referinta_id = 'ed96e9f5-0c74-45a6-bb3f-96630f57cba2' AND tip = 'vanzare';

-- 2. Șterg comenzile test Andrei Popa
DELETE FROM comenzi WHERE client_nume_manual = 'Andrei Popa' AND demo_seed_id IS NULL;
;
