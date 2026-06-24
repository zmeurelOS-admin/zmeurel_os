-- +0.5 kg recoltare pentru consum propriu
INSERT INTO miscari_stoc (id, tenant_id, locatie_id, produs, calitate, depozit, tip_miscare, cantitate_kg, referinta_id, data, tip, cantitate_cal1, cantitate_cal2, observatii, created_at)
VALUES (gen_random_uuid(), '99485d6b-f186-49db-a379-bb9a12d34968', '5e5a6ed8-bbfb-4783-af87-bdf8f182dcc8', 'Zmeură', 'cal1', 'fresh', 'recoltare', 0.5, '7c5e0bdb-1181-4035-a2f8-6a9973b48cc7', '2026-06-23', 'recoltare', 0.5, 0, 'Ajustare recoltare REC5234', '2026-06-23 16:59:00+00');

-- Consum propriu 0.5 kg
INSERT INTO miscari_stoc (id, tenant_id, locatie_id, produs, calitate, depozit, tip_miscare, cantitate_kg, referinta_id, data, tip, cantitate_cal1, cantitate_cal2, observatii, created_at)
VALUES (gen_random_uuid(), '99485d6b-f186-49db-a379-bb9a12d34968', '5e5a6ed8-bbfb-4783-af87-bdf8f182dcc8', 'Zmeură', 'cal1', 'fresh', 'vanzare', 0.5, '094ab5e7-c372-4560-835d-77279fe4b23b', '2026-06-23', 'vanzare', -0.5, 0, 'Consum propriu', '2026-06-23 18:00:01+00');
