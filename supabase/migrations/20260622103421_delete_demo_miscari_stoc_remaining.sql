
DELETE FROM miscari_stoc 
WHERE referinta_id IN (
  SELECT ms.referinta_id FROM miscari_stoc ms
  JOIN recoltari r ON r.id = ms.referinta_id
  WHERE r.demo_seed_id IS NOT NULL
);
;
