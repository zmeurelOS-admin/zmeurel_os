
-- Șterg recoltările test
DELETE FROM recoltari WHERE id IN (
  '801e5bfb-0577-46c7-877d-0bb878f0bdd6',
  '7adb4899-b2ab-4128-844d-21bf05a28346'
);

-- Șterg comanda test Cosmin (fără vânzare linkată, deci nu atinge stocul)
DELETE FROM comenzi WHERE id = '44d5ca62-d4d6-4966-9d6a-da536f473251';

-- Șterg parcela test
DELETE FROM parcele WHERE nume_parcela = 'PARCELA_REPORTS_SUITE';
;
