-- Capcanele (promptul 29): montarea în grupuri pe parcelă, verificarea pe fiecare capcană, pragul pe fermă,
-- poza în bucketul privat `capcane`. Refolosește tabelele care există deja în producție (`capcane_montate`,
-- `capcane_verificari`, 0 rânduri la 23.11.2026) și adaugă doar ce lipsește. Nu atinge date existente.
--
-- NEAPLICATĂ: o rulează Andrei, după merge. Se rulează DUPĂ 20261122110000_analize_fructe.sql (folosește
-- `operator_can_read`), aplicată deja în producție. Schema de pornire citită din producție pe 23.11.2026
-- (`information_schema.columns`, `pg_constraint`, `pg_policies`, `pg_indexes`, `storage.buckets`).
--
-- Ce adaugă / schimbă:
--   * `capcane_montate`:
--       - `interval_verificare_zile int not null default 7` (1–60): „Verific la N zile”;
--       - `interval_atractant_zile int null` (1–60): null = implicit (7 zile pentru Drosophila, nimic pentru rest);
--       - `data_schimb_atractant date null`: ultima schimbare a atractantului (null = de la montare);
--       - `client_sync_id uuid null` + index unic parțial pe `(tenant_id, client_sync_id)`.
--         Montarea pe mai multe parcele face câte un grup pe parcelă: fiecare grup are cheia lui (derivată în
--         aplicație din cheia formularului), deci indexul unic rămâne pe `(tenant_id, client_sync_id)`.
--       - `tip_capcana`: valorile noi `drosophila` / `lipicioasa_galbena` / `feromoni` / `alta`. Verificarea
--         existentă (`drosophila_otet`, `lipicioasa_galbena`, `lipicioasa_albastra`, `feromonala`, `altul`) se
--         înlocuiește cu una care le primește pe toate (cele vechi rămân valide; tabelul e gol).
--       - `status`: valorile noi `activa` / `scoasa` (implicit `activa`). Verificarea existentă (`activ`, `scos`,
--         `expirat`) se înlocuiește cu una care le primește pe toate. Index parțial nou pe `status = 'activa'`.
--   * `capcane_verificari`:
--       - `capcana_nr int null` (≥ 1): capturile sunt pe fiecare capcană din grup (1..`nr_bucati`);
--       - `atractant_schimbat boolean not null default false`;
--       - `client_sync_id uuid null` + index unic parțial pe `(tenant_id, capcana_montata_id, client_sync_id,
--         capcana_nr)`: o verificare pe grup = câte un rând pe capcană, aceeași dată și aceeași cheie.
--       - triggerul `capcane_dupa_verificare`: după fiecare rând nou, grupul primește
--         `data_urmatoarea_verificare = ultima verificare + interval_verificare_zile` și
--         `data_schimb_atractant = ultima verificare cu atractantul schimbat`. Rulează cu drepturile celui care
--         inserează (fără SECURITY DEFINER): cine poate insera verificarea poate modifica și grupul (aceeași regulă).
--   * `tenant_settings.prag_capcane jsonb null`: pragul pe tip de capcană, de ex.
--     `{"drosophila":{"prag":1,"doar_in_coacere":true}}`. Null = implicitul aplicației (Drosophila 1 captură /
--     capcană / săptămână, doar în coacere; restul fără prag). Îl scrie doar proprietarul (politicile existente).
--   * RLS: citirea pe ambele tabele cere și `operator_can_read('tratamente')` (până acum doar fermă). Inserarea și
--     modificarea (proprietarul sau `operator_can_write('tratamente')`) și ștergerea (proprietarul) se potrivesc
--     deja și rămân.
--   * Storage, bucketul privat `capcane` (există deja): politicile vechi citeau `auth.jwt() ->> 'tenant_id'`, care nu
--     există în token, deci nu lăsau nimic. Se înlocuiesc cu aceleași reguli ca la `analize`: prefixul
--     `<tenant>/`, citire cu `operator_can_read('tratamente')`, urcare / înlocuire / ștergere cu
--     `operator_can_write('tratamente')`.
--
-- Până la aplicare aplicația merge ca azi: tab-ul Capcane arată „după actualizarea bazei de date”, cronul nu trimite
-- mementoul, registrul nu are secțiunea de capcane, iar seed-ul demo nu pune capcane.
--
-- Anulare (doar dacă e nevoie; pierde intervalele, pragurile și verificările pe capcană):
--   drop trigger if exists capcane_dupa_verificare on public.capcane_verificari;
--   drop function if exists public.capcane_trg_dupa_verificare();
--   drop index if exists public.capcane_verificari_client_sync_uidx;
--   drop index if exists public.capcane_montate_client_sync_uidx;
--   drop index if exists public.idx_capcane_montate_activa;
--   alter table public.capcane_verificari drop column if exists capcana_nr,
--     drop column if exists atractant_schimbat, drop column if exists client_sync_id;
--   alter table public.capcane_montate drop column if exists interval_verificare_zile,
--     drop column if exists interval_atractant_zile, drop column if exists data_schimb_atractant,
--     drop column if exists client_sync_id;
--   alter table public.tenant_settings drop column if exists prag_capcane;
--   (verificările vechi de tip / status și politicile vechi se pun la loc din 20260512120002_capcane_montate.sql
--    și 20260513113000_create_capcane_storage_bucket.sql)

begin;

-- ─── capcane_montate ─────────────────────────────────────────────────────────────────────────────

alter table public.capcane_montate
  add column if not exists interval_verificare_zile integer not null default 7,
  add column if not exists interval_atractant_zile integer null,
  add column if not exists data_schimb_atractant date null,
  add column if not exists client_sync_id uuid null;

alter table public.capcane_montate drop constraint if exists capcane_montate_interval_verificare_check;
alter table public.capcane_montate add constraint capcane_montate_interval_verificare_check
  check (interval_verificare_zile between 1 and 60);

alter table public.capcane_montate drop constraint if exists capcane_montate_interval_atractant_check;
alter table public.capcane_montate add constraint capcane_montate_interval_atractant_check
  check (interval_atractant_zile is null or interval_atractant_zile between 1 and 60);

alter table public.capcane_montate drop constraint if exists capcane_montate_tip_capcana_check;
alter table public.capcane_montate add constraint capcane_montate_tip_capcana_check
  check (tip_capcana = any (array[
    'drosophila', 'lipicioasa_galbena', 'feromoni', 'alta',
    'drosophila_otet', 'lipicioasa_albastra', 'feromonala', 'altul'
  ]::text[]));

alter table public.capcane_montate drop constraint if exists capcane_montate_status_check;
alter table public.capcane_montate add constraint capcane_montate_status_check
  check (status = any (array['activa', 'scoasa', 'activ', 'scos', 'expirat']::text[]));

alter table public.capcane_montate alter column status set default 'activa';

create unique index if not exists capcane_montate_client_sync_uidx
  on public.capcane_montate (tenant_id, client_sync_id)
  where client_sync_id is not null;

create index if not exists idx_capcane_montate_activa
  on public.capcane_montate (tenant_id, data_urmatoarea_verificare)
  where status = 'activa';

comment on column public.capcane_montate.interval_verificare_zile is
  'La câte zile se verifică grupul (implicit 7). După o verificare: data_urmatoarea_verificare = data + interval.';
comment on column public.capcane_montate.interval_atractant_zile is
  'La câte zile se schimbă atractantul. Null = implicit: 7 zile pentru Drosophila, nimic pentru celelalte.';
comment on column public.capcane_montate.data_schimb_atractant is
  'Ultima schimbare a atractantului (din verificări). Null = de la montare.';

-- ─── capcane_verificari ──────────────────────────────────────────────────────────────────────────

alter table public.capcane_verificari
  add column if not exists capcana_nr integer null,
  add column if not exists atractant_schimbat boolean not null default false,
  add column if not exists client_sync_id uuid null;

alter table public.capcane_verificari drop constraint if exists capcane_verificari_capcana_nr_check;
alter table public.capcane_verificari add constraint capcane_verificari_capcana_nr_check
  check (capcana_nr is null or capcana_nr >= 1);

create unique index if not exists capcane_verificari_client_sync_uidx
  on public.capcane_verificari (tenant_id, capcana_montata_id, client_sync_id, capcana_nr)
  where client_sync_id is not null;

comment on column public.capcane_verificari.capcana_nr is
  'Capcana din grup (1..nr_bucati). O verificare a grupului = câte un rând pe capcană, aceeași dată.';

-- După o verificare: următoarea verificare și ultima schimbare a atractantului, pe grup.
create or replace function public.capcane_trg_dupa_verificare()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.capcane_montate m
     set data_urmatoarea_verificare = v.ultima + m.interval_verificare_zile,
         data_schimb_atractant = coalesce(v.ultim_atractant, m.data_schimb_atractant),
         updated_at = now()
    from (
      select max(cv.data_verificare) as ultima,
             max(cv.data_verificare) filter (where cv.atractant_schimbat) as ultim_atractant
        from public.capcane_verificari cv
       where cv.capcana_montata_id = new.capcana_montata_id
    ) v
   where m.id = new.capcana_montata_id
     and v.ultima is not null;
  return null;
end;
$$;

revoke execute on function public.capcane_trg_dupa_verificare() from public, anon;

drop trigger if exists capcane_dupa_verificare on public.capcane_verificari;
create trigger capcane_dupa_verificare
  after insert on public.capcane_verificari
  for each row execute function public.capcane_trg_dupa_verificare();

-- ─── Pragul, pe fermă ────────────────────────────────────────────────────────────────────────────

alter table public.tenant_settings
  add column if not exists prag_capcane jsonb null;

comment on column public.tenant_settings.prag_capcane is
  'Pragul la capcane, pe tip: {"drosophila":{"prag":1,"doar_in_coacere":true}}. Null = implicitul aplicației.';

-- ─── RLS: citirea cere și dreptul pe Tratamente ──────────────────────────────────────────────────

drop policy if exists capcane_montate_select on public.capcane_montate;
create policy capcane_montate_select on public.capcane_montate for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.operator_can_read('tratamente'));

drop policy if exists capcane_verificari_select on public.capcane_verificari;
create policy capcane_verificari_select on public.capcane_verificari for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.operator_can_read('tratamente'));

-- ─── Storage: bucketul privat `capcane`, pe prefixul fermei ─────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('capcane', 'capcane', false)
on conflict (id) do nothing;

drop policy if exists capcane_upload_own_tenant on storage.objects;
drop policy if exists capcane_view_own_tenant on storage.objects;
drop policy if exists capcane_delete_own_tenant on storage.objects;

drop policy if exists "Capcane: citire pe tenant" on storage.objects;
create policy "Capcane: citire pe tenant" on storage.objects for select to authenticated
  using (
    bucket_id = 'capcane'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
    and public.operator_can_read('tratamente')
  );

drop policy if exists "Capcane: urcare pe tenant" on storage.objects;
create policy "Capcane: urcare pe tenant" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'capcane'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
    and public.operator_can_write('tratamente')
  );

drop policy if exists "Capcane: înlocuire pe tenant" on storage.objects;
create policy "Capcane: înlocuire pe tenant" on storage.objects for update to authenticated
  using (
    bucket_id = 'capcane'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
    and public.operator_can_write('tratamente')
  )
  with check (
    bucket_id = 'capcane'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
    and public.operator_can_write('tratamente')
  );

drop policy if exists "Capcane: ștergere pe tenant" on storage.objects;
create policy "Capcane: ștergere pe tenant" on storage.objects for delete to authenticated
  using (
    bucket_id = 'capcane'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
    and public.operator_can_write('tratamente')
  );

commit;
