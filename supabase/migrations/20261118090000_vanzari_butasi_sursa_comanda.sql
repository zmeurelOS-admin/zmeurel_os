-- Sursa comenzii de material săditor (WhatsApp, telefon, Messenger etc.).
-- Migrare strict aditivă: adaugă o coloană nullable. Nu modifică și nu șterge date existente.

alter table public.vanzari_butasi
  add column if not exists sursa_comanda text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'vanzari_butasi_sursa_comanda_check'
      and conrelid = 'public.vanzari_butasi'::regclass
  ) then
    alter table public.vanzari_butasi
      add constraint vanzari_butasi_sursa_comanda_check
      check (
        sursa_comanda is null
        or sursa_comanda in ('whatsapp', 'telefon', 'messenger', 'instagram', 'facebook', 'personal', 'altul')
      );
  end if;
end $$;

comment on column public.vanzari_butasi.sursa_comanda is
  'Canalul prin care a venit comanda: whatsapp | telefon | messenger | instagram | facebook | personal | altul';

notify pgrst, 'reload schema';
