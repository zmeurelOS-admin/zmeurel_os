-- Normalizează doar formatul codurilor pentru stadii fenologice; nu schimbă semantic datele,
-- nu șterge rânduri și nu modifică schema.
--
-- Mapări aplicate:
-- - repaus_vegetativ -> repaus_vegetativ
-- - repaus -> repaus_vegetativ
-- - Repaus vegetativ -> repaus_vegetativ
-- - umflare_muguri -> umflare_muguri
-- - Umflare muguri -> umflare_muguri
-- - dezmugurire -> umflare_muguri
-- - buton_verde -> buton_verde
-- - Buton verde -> buton_verde
-- - inmugurire -> buton_verde
-- - buton_roz -> buton_roz
-- - Buton roz -> buton_roz
-- - prefloral -> buton_roz
-- - inflorit -> inflorit
-- - inflorire -> inflorit
-- - Înflorit / Inflorit / Înflorire / Inflorire -> inflorit
-- - scuturare_petale -> scuturare_petale
-- - Scuturare petale -> scuturare_petale
-- - cadere_petale / Cădere petale -> scuturare_petale
-- - fruct_verde -> fruct_verde
-- - Fruct verde -> fruct_verde
-- - legare_fruct / Legare fruct -> fruct_verde
-- - crestere_fruct / Creștere fruct -> fruct_verde
-- - parga -> parga
-- - Pârgă / Parga -> parga
-- - parguire / Pârguire / Parguire -> parga
-- - maturitate -> maturitate
-- - Maturitate -> maturitate
-- - maturare / Maturare -> maturitate
-- - post_recoltare -> post_recoltare
-- - Post-recoltare / Post recoltare -> post_recoltare
--
-- Migrare inversă conceptuală:
-- - o migrare simetrică poate remapa codurile canonice în etichetele afișate sau în vocabularul vechi,
--   folosind același CASE explicit, dacă va fi nevoie de rollback logic.

do $$
declare
  unexpected_stadii text[];
  unexpected_triggers text[];
  unexpected_aplicari text[];
begin
  select array_agg(distinct stadiu order by stadiu)
  into unexpected_stadii
  from public.stadii_fenologice_parcela
  where stadiu is not null
    and btrim(stadiu) <> ''
    and stadiu not in (
      'repaus_vegetativ', 'repaus', 'Repaus vegetativ',
      'umflare_muguri', 'Umflare muguri', 'dezmugurire',
      'buton_verde', 'Buton verde', 'inmugurire',
      'buton_roz', 'Buton roz', 'prefloral',
      'inflorit', 'inflorire', 'Înflorit', 'Inflorit', 'Înflorire', 'Inflorire',
      'scuturare_petale', 'Scuturare petale', 'cadere_petale', 'Cădere petale',
      'fruct_verde', 'Fruct verde', 'legare_fruct', 'Legare fruct', 'crestere_fruct', 'Creștere fruct',
      'parga', 'Pârgă', 'Parga', 'parguire', 'Pârguire', 'Parguire',
      'maturitate', 'Maturitate', 'maturare', 'Maturare',
      'post_recoltare', 'Post-recoltare', 'Post recoltare'
    );

  if unexpected_stadii is not null then
    raise notice 'stadii_fenologice_parcela.stadiu conține valori nemapate: %', unexpected_stadii;
  end if;

  select array_agg(distinct stadiu_trigger order by stadiu_trigger)
  into unexpected_triggers
  from public.planuri_tratament_linii
  where stadiu_trigger is not null
    and btrim(stadiu_trigger) <> ''
    and stadiu_trigger not in (
      'repaus_vegetativ', 'repaus', 'Repaus vegetativ',
      'umflare_muguri', 'Umflare muguri', 'dezmugurire',
      'buton_verde', 'Buton verde', 'inmugurire',
      'buton_roz', 'Buton roz', 'prefloral',
      'inflorit', 'inflorire', 'Înflorit', 'Inflorit', 'Înflorire', 'Inflorire',
      'scuturare_petale', 'Scuturare petale', 'cadere_petale', 'Cădere petale',
      'fruct_verde', 'Fruct verde', 'legare_fruct', 'Legare fruct', 'crestere_fruct', 'Creștere fruct',
      'parga', 'Pârgă', 'Parga', 'parguire', 'Pârguire', 'Parguire',
      'maturitate', 'Maturitate', 'maturare', 'Maturare',
      'post_recoltare', 'Post-recoltare', 'Post recoltare'
    );

  if unexpected_triggers is not null then
    raise notice 'planuri_tratament_linii.stadiu_trigger conține valori nemapate: %', unexpected_triggers;
  end if;

  select array_agg(distinct stadiu_la_aplicare order by stadiu_la_aplicare)
  into unexpected_aplicari
  from public.aplicari_tratament
  where stadiu_la_aplicare is not null
    and btrim(stadiu_la_aplicare) <> ''
    and stadiu_la_aplicare not in (
      'repaus_vegetativ', 'repaus', 'Repaus vegetativ',
      'umflare_muguri', 'Umflare muguri', 'dezmugurire',
      'buton_verde', 'Buton verde', 'inmugurire',
      'buton_roz', 'Buton roz', 'prefloral',
      'inflorit', 'inflorire', 'Înflorit', 'Inflorit', 'Înflorire', 'Inflorire',
      'scuturare_petale', 'Scuturare petale', 'cadere_petale', 'Cădere petale',
      'fruct_verde', 'Fruct verde', 'legare_fruct', 'Legare fruct', 'crestere_fruct', 'Creștere fruct',
      'parga', 'Pârgă', 'Parga', 'parguire', 'Pârguire', 'Parguire',
      'maturitate', 'Maturitate', 'maturare', 'Maturare',
      'post_recoltare', 'Post-recoltare', 'Post recoltare'
    );

  if unexpected_aplicari is not null then
    raise notice 'aplicari_tratament.stadiu_la_aplicare conține valori nemapate: %', unexpected_aplicari;
  end if;
end
$$;

update public.stadii_fenologice_parcela
set stadiu = case stadiu
  when 'repaus_vegetativ' then 'repaus_vegetativ'
  when 'repaus' then 'repaus_vegetativ'
  when 'Repaus vegetativ' then 'repaus_vegetativ'
  when 'umflare_muguri' then 'umflare_muguri'
  when 'Umflare muguri' then 'umflare_muguri'
  when 'dezmugurire' then 'umflare_muguri'
  when 'buton_verde' then 'buton_verde'
  when 'Buton verde' then 'buton_verde'
  when 'inmugurire' then 'buton_verde'
  when 'buton_roz' then 'buton_roz'
  when 'Buton roz' then 'buton_roz'
  when 'prefloral' then 'buton_roz'
  when 'inflorit' then 'inflorit'
  when 'inflorire' then 'inflorit'
  when 'Înflorit' then 'inflorit'
  when 'Inflorit' then 'inflorit'
  when 'Înflorire' then 'inflorit'
  when 'Inflorire' then 'inflorit'
  when 'scuturare_petale' then 'scuturare_petale'
  when 'Scuturare petale' then 'scuturare_petale'
  when 'cadere_petale' then 'scuturare_petale'
  when 'Cădere petale' then 'scuturare_petale'
  when 'fruct_verde' then 'fruct_verde'
  when 'Fruct verde' then 'fruct_verde'
  when 'legare_fruct' then 'fruct_verde'
  when 'Legare fruct' then 'fruct_verde'
  when 'crestere_fruct' then 'fruct_verde'
  when 'Creștere fruct' then 'fruct_verde'
  when 'parga' then 'parga'
  when 'Pârgă' then 'parga'
  when 'Parga' then 'parga'
  when 'parguire' then 'parga'
  when 'Pârguire' then 'parga'
  when 'Parguire' then 'parga'
  when 'maturitate' then 'maturitate'
  when 'Maturitate' then 'maturitate'
  when 'maturare' then 'maturitate'
  when 'Maturare' then 'maturitate'
  when 'post_recoltare' then 'post_recoltare'
  when 'Post-recoltare' then 'post_recoltare'
  when 'Post recoltare' then 'post_recoltare'
  else stadiu
end
where stadiu is not null
  and stadiu is distinct from case stadiu
    when 'repaus_vegetativ' then 'repaus_vegetativ'
    when 'repaus' then 'repaus_vegetativ'
    when 'Repaus vegetativ' then 'repaus_vegetativ'
    when 'umflare_muguri' then 'umflare_muguri'
    when 'Umflare muguri' then 'umflare_muguri'
    when 'dezmugurire' then 'umflare_muguri'
    when 'buton_verde' then 'buton_verde'
    when 'Buton verde' then 'buton_verde'
    when 'inmugurire' then 'buton_verde'
    when 'buton_roz' then 'buton_roz'
    when 'Buton roz' then 'buton_roz'
    when 'prefloral' then 'buton_roz'
    when 'inflorit' then 'inflorit'
    when 'inflorire' then 'inflorit'
    when 'Înflorit' then 'inflorit'
    when 'Inflorit' then 'inflorit'
    when 'Înflorire' then 'inflorit'
    when 'Inflorire' then 'inflorit'
    when 'scuturare_petale' then 'scuturare_petale'
    when 'Scuturare petale' then 'scuturare_petale'
    when 'cadere_petale' then 'scuturare_petale'
    when 'Cădere petale' then 'scuturare_petale'
    when 'fruct_verde' then 'fruct_verde'
    when 'Fruct verde' then 'fruct_verde'
    when 'legare_fruct' then 'fruct_verde'
    when 'Legare fruct' then 'fruct_verde'
    when 'crestere_fruct' then 'fruct_verde'
    when 'Creștere fruct' then 'fruct_verde'
    when 'parga' then 'parga'
    when 'Pârgă' then 'parga'
    when 'Parga' then 'parga'
    when 'parguire' then 'parga'
    when 'Pârguire' then 'parga'
    when 'Parguire' then 'parga'
    when 'maturitate' then 'maturitate'
    when 'Maturitate' then 'maturitate'
    when 'maturare' then 'maturitate'
    when 'Maturare' then 'maturitate'
    when 'post_recoltare' then 'post_recoltare'
    when 'Post-recoltare' then 'post_recoltare'
    when 'Post recoltare' then 'post_recoltare'
    else stadiu
  end;

update public.planuri_tratament_linii
set stadiu_trigger = case stadiu_trigger
  when 'repaus_vegetativ' then 'repaus_vegetativ'
  when 'repaus' then 'repaus_vegetativ'
  when 'Repaus vegetativ' then 'repaus_vegetativ'
  when 'umflare_muguri' then 'umflare_muguri'
  when 'Umflare muguri' then 'umflare_muguri'
  when 'dezmugurire' then 'umflare_muguri'
  when 'buton_verde' then 'buton_verde'
  when 'Buton verde' then 'buton_verde'
  when 'inmugurire' then 'buton_verde'
  when 'buton_roz' then 'buton_roz'
  when 'Buton roz' then 'buton_roz'
  when 'prefloral' then 'buton_roz'
  when 'inflorit' then 'inflorit'
  when 'inflorire' then 'inflorit'
  when 'Înflorit' then 'inflorit'
  when 'Inflorit' then 'inflorit'
  when 'Înflorire' then 'inflorit'
  when 'Inflorire' then 'inflorit'
  when 'scuturare_petale' then 'scuturare_petale'
  when 'Scuturare petale' then 'scuturare_petale'
  when 'cadere_petale' then 'scuturare_petale'
  when 'Cădere petale' then 'scuturare_petale'
  when 'fruct_verde' then 'fruct_verde'
  when 'Fruct verde' then 'fruct_verde'
  when 'legare_fruct' then 'fruct_verde'
  when 'Legare fruct' then 'fruct_verde'
  when 'crestere_fruct' then 'fruct_verde'
  when 'Creștere fruct' then 'fruct_verde'
  when 'parga' then 'parga'
  when 'Pârgă' then 'parga'
  when 'Parga' then 'parga'
  when 'parguire' then 'parga'
  when 'Pârguire' then 'parga'
  when 'Parguire' then 'parga'
  when 'maturitate' then 'maturitate'
  when 'Maturitate' then 'maturitate'
  when 'maturare' then 'maturitate'
  when 'Maturare' then 'maturitate'
  when 'post_recoltare' then 'post_recoltare'
  when 'Post-recoltare' then 'post_recoltare'
  when 'Post recoltare' then 'post_recoltare'
  else stadiu_trigger
end
where stadiu_trigger is not null
  and stadiu_trigger is distinct from case stadiu_trigger
    when 'repaus_vegetativ' then 'repaus_vegetativ'
    when 'repaus' then 'repaus_vegetativ'
    when 'Repaus vegetativ' then 'repaus_vegetativ'
    when 'umflare_muguri' then 'umflare_muguri'
    when 'Umflare muguri' then 'umflare_muguri'
    when 'dezmugurire' then 'umflare_muguri'
    when 'buton_verde' then 'buton_verde'
    when 'Buton verde' then 'buton_verde'
    when 'inmugurire' then 'buton_verde'
    when 'buton_roz' then 'buton_roz'
    when 'Buton roz' then 'buton_roz'
    when 'prefloral' then 'buton_roz'
    when 'inflorit' then 'inflorit'
    when 'inflorire' then 'inflorit'
    when 'Înflorit' then 'inflorit'
    when 'Inflorit' then 'inflorit'
    when 'Înflorire' then 'inflorit'
    when 'Inflorire' then 'inflorit'
    when 'scuturare_petale' then 'scuturare_petale'
    when 'Scuturare petale' then 'scuturare_petale'
    when 'cadere_petale' then 'scuturare_petale'
    when 'Cădere petale' then 'scuturare_petale'
    when 'fruct_verde' then 'fruct_verde'
    when 'Fruct verde' then 'fruct_verde'
    when 'legare_fruct' then 'fruct_verde'
    when 'Legare fruct' then 'fruct_verde'
    when 'crestere_fruct' then 'fruct_verde'
    when 'Creștere fruct' then 'fruct_verde'
    when 'parga' then 'parga'
    when 'Pârgă' then 'parga'
    when 'Parga' then 'parga'
    when 'parguire' then 'parga'
    when 'Pârguire' then 'parga'
    when 'Parguire' then 'parga'
    when 'maturitate' then 'maturitate'
    when 'Maturitate' then 'maturitate'
    when 'maturare' then 'maturitate'
    when 'Maturare' then 'maturitate'
    when 'post_recoltare' then 'post_recoltare'
    when 'Post-recoltare' then 'post_recoltare'
    when 'Post recoltare' then 'post_recoltare'
    else stadiu_trigger
  end;

update public.aplicari_tratament
set stadiu_la_aplicare = case stadiu_la_aplicare
  when 'repaus_vegetativ' then 'repaus_vegetativ'
  when 'repaus' then 'repaus_vegetativ'
  when 'Repaus vegetativ' then 'repaus_vegetativ'
  when 'umflare_muguri' then 'umflare_muguri'
  when 'Umflare muguri' then 'umflare_muguri'
  when 'dezmugurire' then 'umflare_muguri'
  when 'buton_verde' then 'buton_verde'
  when 'Buton verde' then 'buton_verde'
  when 'inmugurire' then 'buton_verde'
  when 'buton_roz' then 'buton_roz'
  when 'Buton roz' then 'buton_roz'
  when 'prefloral' then 'buton_roz'
  when 'inflorit' then 'inflorit'
  when 'inflorire' then 'inflorit'
  when 'Înflorit' then 'inflorit'
  when 'Inflorit' then 'inflorit'
  when 'Înflorire' then 'inflorit'
  when 'Inflorire' then 'inflorit'
  when 'scuturare_petale' then 'scuturare_petale'
  when 'Scuturare petale' then 'scuturare_petale'
  when 'cadere_petale' then 'scuturare_petale'
  when 'Cădere petale' then 'scuturare_petale'
  when 'fruct_verde' then 'fruct_verde'
  when 'Fruct verde' then 'fruct_verde'
  when 'legare_fruct' then 'fruct_verde'
  when 'Legare fruct' then 'fruct_verde'
  when 'crestere_fruct' then 'fruct_verde'
  when 'Creștere fruct' then 'fruct_verde'
  when 'parga' then 'parga'
  when 'Pârgă' then 'parga'
  when 'Parga' then 'parga'
  when 'parguire' then 'parga'
  when 'Pârguire' then 'parga'
  when 'Parguire' then 'parga'
  when 'maturitate' then 'maturitate'
  when 'Maturitate' then 'maturitate'
  when 'maturare' then 'maturitate'
  when 'Maturare' then 'maturitate'
  when 'post_recoltare' then 'post_recoltare'
  when 'Post-recoltare' then 'post_recoltare'
  when 'Post recoltare' then 'post_recoltare'
  else stadiu_la_aplicare
end
where stadiu_la_aplicare is not null
  and stadiu_la_aplicare is distinct from case stadiu_la_aplicare
    when 'repaus_vegetativ' then 'repaus_vegetativ'
    when 'repaus' then 'repaus_vegetativ'
    when 'Repaus vegetativ' then 'repaus_vegetativ'
    when 'umflare_muguri' then 'umflare_muguri'
    when 'Umflare muguri' then 'umflare_muguri'
    when 'dezmugurire' then 'umflare_muguri'
    when 'buton_verde' then 'buton_verde'
    when 'Buton verde' then 'buton_verde'
    when 'inmugurire' then 'buton_verde'
    when 'buton_roz' then 'buton_roz'
    when 'Buton roz' then 'buton_roz'
    when 'prefloral' then 'buton_roz'
    when 'inflorit' then 'inflorit'
    when 'inflorire' then 'inflorit'
    when 'Înflorit' then 'inflorit'
    when 'Inflorit' then 'inflorit'
    when 'Înflorire' then 'inflorit'
    when 'Inflorire' then 'inflorit'
    when 'scuturare_petale' then 'scuturare_petale'
    when 'Scuturare petale' then 'scuturare_petale'
    when 'cadere_petale' then 'scuturare_petale'
    when 'Cădere petale' then 'scuturare_petale'
    when 'fruct_verde' then 'fruct_verde'
    when 'Fruct verde' then 'fruct_verde'
    when 'legare_fruct' then 'fruct_verde'
    when 'Legare fruct' then 'fruct_verde'
    when 'crestere_fruct' then 'fruct_verde'
    when 'Creștere fruct' then 'fruct_verde'
    when 'parga' then 'parga'
    when 'Pârgă' then 'parga'
    when 'Parga' then 'parga'
    when 'parguire' then 'parga'
    when 'Pârguire' then 'parga'
    when 'Parguire' then 'parga'
    when 'maturitate' then 'maturitate'
    when 'Maturitate' then 'maturitate'
    when 'maturare' then 'maturitate'
    when 'Maturare' then 'maturitate'
    when 'post_recoltare' then 'post_recoltare'
    when 'Post-recoltare' then 'post_recoltare'
    when 'Post recoltare' then 'post_recoltare'
    else stadiu_la_aplicare
  end;
