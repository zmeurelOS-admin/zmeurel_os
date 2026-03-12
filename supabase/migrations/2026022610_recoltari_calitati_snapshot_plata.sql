alter table public.recoltari
  add column if not exists kg_cal1 numeric not null default 0,
  add column if not exists kg_cal2 numeric not null default 0,
  add column if not exists pret_lei_pe_kg_snapshot numeric not null default 0,
  add column if not exists valoare_munca_lei numeric not null default 0;

update public.recoltari r
set
  kg_cal1 = case
    when coalesce(r.kg_cal1, 0) = 0 and coalesce(r.kg_cal2, 0) = 0 then coalesce(r.cantitate_kg, 0)
    else coalesce(r.kg_cal1, 0)
  end,
  kg_cal2 = coalesce(r.kg_cal2, 0),
  pret_lei_pe_kg_snapshot = coalesce(
    nullif(r.pret_lei_pe_kg_snapshot, 0),
    c.tarif_lei_kg,
    0
  ),
  valoare_munca_lei = (coalesce(r.kg_cal1, 0) + coalesce(r.kg_cal2, 0)) * coalesce(
    nullif(r.pret_lei_pe_kg_snapshot, 0),
    c.tarif_lei_kg,
    0
  )
from public.culegatori c
where c.id = r.culegator_id;

update public.recoltari
set
  kg_cal1 = case
    when coalesce(kg_cal1, 0) = 0 and coalesce(kg_cal2, 0) = 0 then coalesce(cantitate_kg, 0)
    else coalesce(kg_cal1, 0)
  end,
  kg_cal2 = coalesce(kg_cal2, 0),
  pret_lei_pe_kg_snapshot = coalesce(pret_lei_pe_kg_snapshot, 0),
  valoare_munca_lei = (coalesce(kg_cal1, 0) + coalesce(kg_cal2, 0)) * coalesce(pret_lei_pe_kg_snapshot, 0)
where culegator_id is null;

notify pgrst, 'reload schema';
