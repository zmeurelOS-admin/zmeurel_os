UPDATE public.tenants
SET demo_seeded = false,
    demo_seeded_at = null,
    demo_seed_id = null
WHERE demo_seeded = true
  AND id NOT IN (
    SELECT DISTINCT tenant_id FROM public.parcele
    WHERE data_origin = 'demo'
  );
