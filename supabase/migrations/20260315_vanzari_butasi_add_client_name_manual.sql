-- Fix: add client_nume_manual column that was referenced in queries but never added to the table.
-- Root cause: createVanzareButasi INSERT succeeded but the follow-up getVanzareButasiById
-- SELECT failed with PGRST204 (column not in schema cache), showing "Nu s-a putut salva."
-- even though the data was saved. This migration adds the missing column.

alter table public.vanzari_butasi
  add column if not exists client_nume_manual text;

notify pgrst, 'reload schema';
