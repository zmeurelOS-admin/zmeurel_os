alter table public.cheltuieli_diverse
  add column if not exists metoda_plata text;

notify pgrst, 'reload schema';
