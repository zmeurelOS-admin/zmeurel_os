
-- Șterg mișcarea duplicat de 0.5 kg pe recoltarea de 9 kg
DELETE FROM miscari_stoc WHERE id = '3107844b-f998-4b66-9cfa-9e301e627bf7';

-- Corectez 9.5 → 9 pe recoltarea de 9 kg
UPDATE miscari_stoc SET cantitate_kg = 9 WHERE id = '7fb4123e-5e7e-4951-8b47-8901353c0b98';

-- Corectez 9 → 8 pe recoltarea de 8 kg
UPDATE miscari_stoc SET cantitate_kg = 8 WHERE id = 'dff30352-0329-4cba-9a8b-b1b0a0c58ce3';
;
