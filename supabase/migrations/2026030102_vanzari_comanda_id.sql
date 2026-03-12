alter table if exists public.vanzari
  add column if not exists comanda_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'vanzari_comanda_id_fkey'
  ) then
    alter table public.vanzari
      add constraint vanzari_comanda_id_fkey
      foreign key (comanda_id)
      references public.comenzi(id)
      on delete set null;
  end if;
end
$$;

create index if not exists vanzari_comanda_id_idx
  on public.vanzari(comanda_id);
