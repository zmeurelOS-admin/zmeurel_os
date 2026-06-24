-- Recoltare suplimentară REC5234 — 1.5 kg pe 23 iunie
INSERT INTO miscari_stoc (
  id, tenant_id, locatie_id, produs, calitate, depozit,
  tip_miscare, cantitate_kg, referinta_id, data,
  tip, cantitate_cal1, cantitate_cal2,
  observatii, created_at
) VALUES (
  gen_random_uuid(),
  '99485d6b-f186-49db-a379-bb9a12d34968',
  '5e5a6ed8-bbfb-4783-af87-bdf8f182dcc8',
  'Zmeură', 'cal1', 'fresh',
  'recoltare', 1.5,
  '7c5e0bdb-1181-4035-a2f8-6a9973b48cc7',
  '2026-06-23',
  'recoltare', 1.5, 0,
  'Recoltare suplimentară REC5234',
  '2026-06-23 17:00:00+00'
);
