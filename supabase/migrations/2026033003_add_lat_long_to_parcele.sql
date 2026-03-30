alter table public.parcele
  add column if not exists latitudine double precision null,
  add column if not exists longitudine double precision null;
