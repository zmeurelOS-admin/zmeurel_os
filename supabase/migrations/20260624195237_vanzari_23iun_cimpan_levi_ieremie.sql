-- Vânzări 23 iun — comenzi shop existente
INSERT INTO miscari_stoc (id, tenant_id, locatie_id, produs, calitate, depozit, tip_miscare, cantitate_kg, referinta_id, data, tip, cantitate_cal1, cantitate_cal2, observatii, created_at)
VALUES (gen_random_uuid(), '99485d6b-f186-49db-a379-bb9a12d34968', '5e5a6ed8-bbfb-4783-af87-bdf8f182dcc8', 'Zmeură', 'cal1', 'fresh', 'vanzare', 10, '205190e0-673f-4512-b8e3-ccb0c9dd0efe', '2026-06-23', 'vanzare', -10, 0, 'Consum stoc prin livrare comanda', '2026-06-23 18:00:00+00');

INSERT INTO miscari_stoc (id, tenant_id, locatie_id, produs, calitate, depozit, tip_miscare, cantitate_kg, referinta_id, data, tip, cantitate_cal1, cantitate_cal2, observatii, created_at)
VALUES (gen_random_uuid(), '99485d6b-f186-49db-a379-bb9a12d34968', '5e5a6ed8-bbfb-4783-af87-bdf8f182dcc8', 'Zmeură', 'cal1', 'fresh', 'vanzare', 2.5, 'dab0b173-b637-487e-84ae-30cb96391471', '2026-06-23', 'vanzare', -2.5, 0, 'Consum stoc prin livrare comanda', '2026-06-23 18:00:00+00');

INSERT INTO miscari_stoc (id, tenant_id, locatie_id, produs, calitate, depozit, tip_miscare, cantitate_kg, referinta_id, data, tip, cantitate_cal1, cantitate_cal2, observatii, created_at)
VALUES (gen_random_uuid(), '99485d6b-f186-49db-a379-bb9a12d34968', '5e5a6ed8-bbfb-4783-af87-bdf8f182dcc8', 'Zmeură', 'cal1', 'fresh', 'vanzare', 1, 'd7158906-394b-4826-9714-8e5b5c1e305c', '2026-06-23', 'vanzare', -1, 0, 'Consum stoc prin livrare comanda', '2026-06-23 18:00:00+00');
