ALTER TABLE public.aplicari_tratament_produse
  DROP CONSTRAINT IF EXISTS aplicari_tratament_produse_unitate_cantitate_check;

ALTER TABLE public.aplicari_tratament_produse
  ADD CONSTRAINT aplicari_tratament_produse_unitate_cantitate_check
  CHECK (
    unitate_cantitate IS NULL
    OR unitate_cantitate IN (
      'ml',
      'l',
      'g',
      'kg',
      'buc',
      'altul',
      'ml_10l',
      'g_10l',
      'kg_parcela',
      'g_parcela',
      'l_parcela',
      'kg_ha',
      'l_ha',
      'saci_50_kg',
      'saci_25_kg',
      'nr_bucati'
    )
  );
