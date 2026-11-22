-- Mementoul dinainte de cules (promptul 26, partea C). Doar aditiv: o coloană nouă și un tabel nou.
--
-- NEAPLICATĂ: o rulează Andrei, după merge și după 20261122110000 (analizele).
-- Schema de pornire citită din producție pe 22.11.2026.
--
-- Ce adaugă:
--   * `configurari_parcela_sezon.data_inceput_cules date null`: data pusă de mână pe fișa parcelei
--     („Culesul începe pe ~… · Schimbă”), pe parcelă și pe sezon (`an`). Tabelul are deja cheia unică
--     `(parcela_id, an)` și politicile pe drepturile Parcele (`operator_can_write('parcele')`), deci data se
--     salvează cu `upsert` pe `(parcela_id, an)`, fără politici noi.
--   * `memento_analize_sezon`: starea mementoului pe fermă și sezon: amânat până la, „Nu fac analize anul acesta”,
--     ultima trimitere. Doar proprietarul (el primește mementoul) citește și scrie. Cronul de dimineață citește cu
--     service role.
--
-- Setările (comutatorul, „Cu câte zile înainte”, „Zilnic din ziua culesului”) stau în preferințele de notificări
-- existente (`notificari_preferinte.tipuri`: cheile `analize`, `analize_zile`, `analize_zilnic`), fără migrare.
--
-- Până la aplicare: data culesului se estimează doar din prima recoltare de anul trecut (fișa nu poate salva data
-- pusă de mână și arată „Schimbă” dezactivat cu explicație), „Amână” și „Nu fac analize anul acesta” răspund
-- „după actualizarea bazei de date”, iar cronul nu trimite mementoul (nu poate ține minte amânarea).
--
-- Anulare (doar dacă e nevoie; pierde datele de cules puse de mână și amânările):
--   drop table if exists public.memento_analize_sezon;
--   alter table public.configurari_parcela_sezon drop column if exists data_inceput_cules;

begin;

alter table public.configurari_parcela_sezon
  add column if not exists data_inceput_cules date null;

comment on column public.configurari_parcela_sezon.data_inceput_cules is
  'Începutul culesului pus de mână pe fișa parcelei, pentru sezonul `an`. Null = se estimează din prima recoltare de anul trecut.';

create table if not exists public.memento_analize_sezon (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  an integer not null check (an between 2000 and 2100),
  amanat_pana date null,
  dezactivat boolean not null default false,
  ultima_trimitere date null,
  ultima_cheie text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, an)
);

comment on table public.memento_analize_sezon is
  'Mementoul „analiza dinainte de cules”, pe fermă și sezon: amânat până la, dezactivat pe sezon, ultima trimitere.';

alter table public.memento_analize_sezon enable row level security;

drop policy if exists memento_analize_sezon_select on public.memento_analize_sezon;
create policy memento_analize_sezon_select on public.memento_analize_sezon for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id));

drop policy if exists memento_analize_sezon_insert on public.memento_analize_sezon;
create policy memento_analize_sezon_insert on public.memento_analize_sezon for insert to authenticated
  with check (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id));

drop policy if exists memento_analize_sezon_update on public.memento_analize_sezon;
create policy memento_analize_sezon_update on public.memento_analize_sezon for update to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id))
  with check (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id));

commit;
