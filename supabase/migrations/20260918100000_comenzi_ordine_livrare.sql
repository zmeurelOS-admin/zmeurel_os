-- Persistă ordinea manuală de livrare (drag-and-drop din /livrari) în DB,
-- ca să fie vizibilă pentru orice utilizator/dispozitiv al aceluiași tenant,
-- nu doar în localStorage-ul browserului care a făcut reordonarea.
alter table public.comenzi
  add column if not exists ordine_livrare integer;

comment on column public.comenzi.ordine_livrare is
  'Poziție manuală în traseul de livrare (drag-and-drop din /livrari). Null = ordine implicită FIFO după data_livrare/created_at.';
