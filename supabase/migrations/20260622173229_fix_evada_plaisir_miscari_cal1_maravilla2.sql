
UPDATE miscari_stoc
SET calitate = 'cal1',
    depozit = 'fresh',
    locatie_id = '25ee4a8a-f106-433b-9593-5940dc99cb87',  -- Maravilla 2 (are 10.5 kg)
    produs = 'Zmeură',
    cantitate_cal1 = -cantitate_kg,
    cantitate_cal2 = 0
WHERE id IN (
  '2f688926-cba3-458b-a5fa-accc75bcdcd5',
  '8b3dae31-1931-4580-8a4d-9a3438f1af94'
);
;
