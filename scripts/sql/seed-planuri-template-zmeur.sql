BEGIN;

WITH upsert_template AS (
  INSERT INTO public.planuri_template (
    cod,
    nume,
    cultura_tip,
    cohort,
    descriere,
    durata_sezon_estimata,
    nr_interventii,
    ordine
  )
  VALUES (
    'zmeur_primocane',
    'Zmeur primocane',
    'zmeur',
    'primocane',
    'Calendar de tratamente și fertilizare pentru zmeur primocane (Maravilla, Polka, Heritage). Acoperă tot ciclul de la dezmugurire la post-recoltare.',
    'martie - octombrie',
    20,
    1
  )
  ON CONFLICT (cod) DO UPDATE SET
    nume = EXCLUDED.nume,
    cultura_tip = EXCLUDED.cultura_tip,
    cohort = EXCLUDED.cohort,
    descriere = EXCLUDED.descriere,
    durata_sezon_estimata = EXCLUDED.durata_sezon_estimata,
    nr_interventii = EXCLUDED.nr_interventii,
    ordine = EXCLUDED.ordine,
    activ = true,
    updated_at = now()
  RETURNING id
),
deleted AS (
  DELETE FROM public.planuri_template_linii
  WHERE template_id IN (SELECT id FROM upsert_template)
)
INSERT INTO public.planuri_template_linii (
  template_id,
  ordine,
  stadiu_trigger,
  cohort_trigger,
  tip_interventie,
  metoda_aplicare,
  scop,
  regula_repetare,
  interval_repetare_zile,
  produs_sugerat_nume,
  produs_sugerat_doza_text
)
SELECT id, v.ordine, v.stadiu_trigger, 'primocane', v.tip_interventie, v.metoda_aplicare, v.scop, v.regula_repetare, v.interval_repetare_zile, v.produs_sugerat_nume, v.produs_sugerat_doza_text
FROM upsert_template
CROSS JOIN (VALUES
  (1, 'umflare_muguri', 'nutritie', 'fertilizare_baza', 'Fertilizare bază pre-vegetație', 'fara_repetare', NULL::integer, 'NPK 16-16-16', '200 kg/ha'),
  (2, 'umflare_muguri', 'igiena', 'foliar', 'Tratament cupric primăvară', 'fara_repetare', NULL::integer, 'Zeamă bordeleză', '5 kg/ha'),
  (3, 'crestere_vegetativa', 'nutritie', 'fertirigare', 'Pornire vegetație N-dominant', 'fara_repetare', NULL::integer, 'Kristalon Albastru', '2 kg/parcelă'),
  (4, 'crestere_vegetativa', 'biostimulare', 'foliar', 'Stimulare creștere', 'fara_repetare', NULL::integer, 'Aminoacizi + Alge', '2 L/ha'),
  (5, 'buton_verde', 'protectie', 'foliar', 'Acarian Phyllocoptes', 'fara_repetare', NULL::integer, 'Vertimec 1.8 EC', '1.2 L/ha'),
  (6, 'buton_verde', 'nutritie', 'fertirigare', 'Stimulare diferențiere florală', 'fara_repetare', NULL::integer, 'Kristalon Galben 13-40-13', '2 kg/parcelă'),
  (7, 'etaj_floral', 'protectie', 'foliar', 'Antracnoză + botritis', 'fara_repetare', NULL::integer, 'Switch 62.5 WG', '0.6 kg/ha'),
  (8, 'inflorit', 'protectie', 'foliar', 'Trips în floare', 'fara_repetare', NULL::integer, 'Laser 240 SC', '0.2 L/ha'),
  (9, 'inflorit', 'biostimulare', 'foliar', 'Bor + Calciu fortificare', 'fara_repetare', NULL::integer, 'Calbit C + Borocal', '2.5 + 1.5 L/ha'),
  (10, 'inflorit', 'monitorizare', 'capcana_pus', 'Monitorizare Drosophila', 'fara_repetare', NULL::integer, NULL, '10 capcane/ha'),
  (11, 'legare_fruct', 'nutritie', 'fertirigare', 'Calciu pentru fruct ferm', 'fara_repetare', NULL::integer, 'Calcinit', '1.5 kg/parcelă'),
  (12, 'legare_fruct', 'protectie', 'foliar', 'Botritis preventiv', 'fara_repetare', NULL::integer, 'Signum', '1.5 kg/ha'),
  (13, 'fruct_verde', 'nutritie', 'fertirigare', 'K-dominant pentru fruct', 'fara_repetare', NULL::integer, 'Kristalon Roșu', '2 kg/parcelă'),
  (14, 'fruct_verde', 'monitorizare', 'capcana_verificat', 'Verificare Drosophila', 'interval', 5, NULL, 'la 5 zile'),
  (15, 'parga', 'protectie', 'foliar', 'Antracnoză pe fruct', 'fara_repetare', NULL::integer, 'Luna Sensation', '0.8 L/ha'),
  (16, 'parga', 'biostimulare', 'foliar', 'Anti-stres termic', 'fara_repetare', NULL::integer, 'Megafol', '2 L/ha'),
  (17, 'maturitate', 'monitorizare', 'capcana_verificat', 'Drosophila intensiv', 'interval', 3, NULL, 'la 3 zile'),
  (18, 'post_recoltare', 'nutritie', 'fertirigare', 'Refacere plantă', 'fara_repetare', NULL::integer, 'KNO3 + MAP', '2 + 1 kg/parcelă'),
  (19, 'post_recoltare', 'igiena', 'foliar', 'Cupric pre-iarnă', 'fara_repetare', NULL::integer, 'Zeamă bordeleză', '5 kg/ha'),
  (20, 'repaus_vegetativ', 'igiena', 'foliar', 'Tratament iarnă', 'fara_repetare', NULL::integer, 'Zeamă bordeleză', '7 kg/ha')
) AS v(ordine, stadiu_trigger, tip_interventie, metoda_aplicare, scop, regula_repetare, interval_repetare_zile, produs_sugerat_nume, produs_sugerat_doza_text);

WITH upsert_template AS (
  INSERT INTO public.planuri_template (
    cod,
    nume,
    cultura_tip,
    cohort,
    descriere,
    durata_sezon_estimata,
    nr_interventii,
    ordine
  )
  VALUES (
    'zmeur_floricane',
    'Zmeur floricane',
    'zmeur',
    'floricane',
    'Calendar specific zmeurului floricane, cu fructificare pe lăstari de anul II și lucrări post-recoltare dedicate.',
    'februarie - noiembrie',
    22,
    2
  )
  ON CONFLICT (cod) DO UPDATE SET
    nume = EXCLUDED.nume,
    cultura_tip = EXCLUDED.cultura_tip,
    cohort = EXCLUDED.cohort,
    descriere = EXCLUDED.descriere,
    durata_sezon_estimata = EXCLUDED.durata_sezon_estimata,
    nr_interventii = EXCLUDED.nr_interventii,
    ordine = EXCLUDED.ordine,
    activ = true,
    updated_at = now()
  RETURNING id
),
deleted AS (
  DELETE FROM public.planuri_template_linii
  WHERE template_id IN (SELECT id FROM upsert_template)
)
INSERT INTO public.planuri_template_linii (
  template_id,
  ordine,
  stadiu_trigger,
  cohort_trigger,
  tip_interventie,
  metoda_aplicare,
  scop,
  regula_repetare,
  interval_repetare_zile,
  produs_sugerat_nume,
  produs_sugerat_doza_text
)
SELECT id, v.ordine, v.stadiu_trigger, 'floricane', v.tip_interventie, v.metoda_aplicare, v.scop, v.regula_repetare, v.interval_repetare_zile, v.produs_sugerat_nume, v.produs_sugerat_doza_text
FROM upsert_template
CROSS JOIN (VALUES
  (1, 'repaus_vegetativ', 'igiena', 'foliar', 'Tratament iarnă (igienă)', 'fara_repetare', NULL::integer, 'Zeamă bordeleză', '7 kg/ha'),
  (2, 'umflare_muguri', 'igiena', 'foliar', 'Cupric primăvară', 'fara_repetare', NULL::integer, 'Zeamă bordeleză', '5 kg/ha'),
  (3, 'umflare_muguri', 'nutritie', 'fertilizare_baza', 'Fertilizare bază', 'fara_repetare', NULL::integer, 'NPK 16-16-16', '250 kg/ha'),
  (4, 'crestere_vegetativa', 'nutritie', 'fertirigare', 'N-dominant pornire', 'fara_repetare', NULL::integer, 'Kristalon Albastru', '2 kg/parcelă'),
  (5, 'crestere_vegetativa', 'biostimulare', 'foliar', 'Biostimulare amino + alge', 'fara_repetare', NULL::integer, 'Aminoacizi + Alge', '2 L/ha'),
  (6, 'buton_verde', 'protectie', 'foliar', 'Acarian', 'fara_repetare', NULL::integer, 'Vertimec 1.8 EC', '1.2 L/ha'),
  (7, 'buton_verde', 'nutritie', 'fertirigare', 'P-dominant', 'fara_repetare', NULL::integer, 'Kristalon Galben', '2 kg/parcelă'),
  (8, 'etaj_floral', 'protectie', 'foliar', 'Antracnoză + botritis', 'fara_repetare', NULL::integer, 'Switch 62.5 WG', '0.6 kg/ha'),
  (9, 'inflorit', 'protectie', 'foliar', 'Trips', 'fara_repetare', NULL::integer, 'Laser 240 SC', '0.2 L/ha'),
  (10, 'inflorit', 'biostimulare', 'foliar', 'Bor + Calciu', 'fara_repetare', NULL::integer, 'Calbit C + Borocal', '2.5 + 1.5 L/ha'),
  (11, 'inflorit', 'monitorizare', 'capcana_pus', 'Pus Drosophila', 'fara_repetare', NULL::integer, NULL, '10 capcane/ha'),
  (12, 'legare_fruct', 'nutritie', 'fertirigare', 'Ca pentru fruct', 'fara_repetare', NULL::integer, 'Calcinit', '1.5 kg/parcelă'),
  (13, 'legare_fruct', 'protectie', 'foliar', 'Botritis preventiv', 'fara_repetare', NULL::integer, 'Signum', '1.5 kg/ha'),
  (14, 'fruct_verde', 'nutritie', 'fertirigare', 'K-dominant', 'fara_repetare', NULL::integer, 'Kristalon Roșu', '2 kg/parcelă'),
  (15, 'fruct_verde', 'monitorizare', 'capcana_verificat', 'Verifică Drosophila', 'interval', 5, NULL, 'la 5 zile'),
  (16, 'parga', 'protectie', 'foliar', 'Antracnoză fruct', 'fara_repetare', NULL::integer, 'Luna Sensation', '0.8 L/ha'),
  (17, 'parga', 'biostimulare', 'foliar', 'Anti-stres', 'fara_repetare', NULL::integer, 'Megafol', '2 L/ha'),
  (18, 'maturitate', 'monitorizare', 'capcana_verificat', 'Drosophila intensiv', 'interval', 3, NULL, 'la 3 zile'),
  (19, 'post_recoltare', 'nutritie', 'fertirigare', 'Refacere plantă', 'fara_repetare', NULL::integer, 'KNO3 + MAP', '2 + 1 kg/parcelă'),
  (20, 'post_recoltare', 'igiena', 'foliar', 'Cupric final', 'fara_repetare', NULL::integer, 'Zeamă bordeleză', '5 kg/ha'),
  (21, 'post_recoltare', 'igiena', 'foliar', 'Tăiere + cupric', 'fara_repetare', NULL::integer, 'Zeamă bordeleză repetare', '5 kg/ha'),
  (22, 'repaus_vegetativ', 'igiena', 'foliar', 'Tratament adânc iarnă', 'fara_repetare', NULL::integer, 'Zeamă bordeleză', '7 kg/ha')
) AS v(ordine, stadiu_trigger, tip_interventie, metoda_aplicare, scop, regula_repetare, interval_repetare_zile, produs_sugerat_nume, produs_sugerat_doza_text);

COMMIT;
