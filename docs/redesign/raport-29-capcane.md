# Raport 29 — Tratamente, partea a doua (2/3): Capcanele

Branch: `redesign/capcane-29`, pornit din `main` (`a3692d1`). Fără merge. O migrare scrisă, **neaplicată**:
`supabase/migrations/20261123100000_capcane.sql`. Din baza de date am citit doar cu `select` (`information_schema`,
`pg_constraint`, `pg_policies`, `pg_indexes`, `pg_proc`, `storage.buckets`, numărători). Cronurile nu au fost apelate,
variabilele din Vercel nu au fost atinse. Tab-ul Plan nu există încă (vine în 30). `public/sw.js` nu e în niciun commit.

## Rezumat pentru Andrei

1. **Tratamente are acum trei taburi: Aplicări · Capcane · Analize.** În Capcane: cardul „Verificare azi · N capcane” (cu „Atractantul se schimbă azi la M”), grupurile pe parcelă (tip, bucăți, capturile din săptămâna ultimei verificări, „peste prag”) și butoanele „Verifică acum” / „+ Montează”.
2. **„+ Montează”**: tipul (4 plăci), parcelele (mai multe → un grup pe fiecare), bucățile, „Verific la 3 / 4 / 7 / 10 / 14 zile”, data și poza (opțional).
3. **„Verifică acum”**: un pas pe capcană („Verificare · 2 din 6”), tastatura mare, câmpul gol la pornire, „Am schimbat atractantul” când e scadent, poză și notă. La final, rezumatul și „Fă un tratament pe Maravilla 1” pentru grupurile peste prag.
4. **Fișa grupului**: barele pe săptămâni, linia punctată a pragului, 💧 la săptămâna unui tratament pe parcelă, lista tratamentelor și a verificărilor, „Scoate capcanele”, „Fă un tratament pe …”.
5. **Pragul** se pune în Notificări → Ce primești → „Pragul la capcane”, pe tip. Implicit doar Drosophila: 1 captură / capcană / săptămână, doar în coacere. „În coacere” = stadiul de coacere sau recoltare de pe fișa parcelei, ori cu 7 zile înainte de culesul estimat.
6. **Mementoul „Verifică capcanele”** pleacă dimineața, în verificarea existentă, ție și operatorilor cu „Scrie” pe Tratamente, și stă în Acasă până se face verificarea. **Alerta „Peste prag”** pleacă imediat după verificare, doar ție, o dată pe grup și săptămână.
7. **Registrul de tratamente** (Rapoarte → Exportă) are secțiunea „Monitorizare cu capcane”: grupurile și capturile pe săptămâni. Raportul public al analizei nu s-a schimbat.
8. **Demo nou**: Drosophila pe Maravilla (capturi 0, 1, 3, 4, 9: peste prag în ultimele 3 săptămâni, verificarea azi), Drosophila pe Delniwa Nord (0 capturi) și lipicioase galbene pe Delniwa Sud. Reîncărcarea demo-ului le șterge.
9. **Tabelele erau deja în producție, goale.** Le-am refolosit: o singură migrare, aditivă. Am lărgit verificările de tip și de stare (valorile vechi rămân valide), am refăcut citirea (cere dreptul pe Tratamente) și politicile bucketului `capcane`, care nu lăsau nimic.
10. **Migrarea se aplică după merge.** Fără ea aplicația merge ca azi: tab-ul spune „Capcanele vor merge după actualizarea bazei de date”, cronul nu trimite nimic, registrul nu are secțiunea.

## 1. Ce am schimbat

| Commit | Ce |
|---|---|
| `9789d78` | **Migrarea** `20261123100000_capcane.sql` (neaplicată) și **logica pură** `src/lib/capcane/` (`model.ts`, `prag.ts`, `coacere.ts`, `scadenta.ts`, `saptamani.ts`, `destinatari.ts`, `formular.ts`, `memento.ts`, `export.ts`), cu 28 de teste. Comutatoarele `capcane` / `capcane_prag` în preferințe. |
| `dd88545` | **Stratul de date** `src/lib/supabase/queries/capcane.ts` (grupuri, verificări, prag, poze în bucketul `capcane`, montare idempotentă pe grup, verificare idempotentă pe grup, „Scoate”) și hook-ul `useCapcane` (cu „în coacere” din stadii și culesul estimat, aceleași chei de cache ca Parcele și Analize). Cheile de query sub `['tratamente', 'capcane', …]`. |
| `ab1dc0c` | **Ecranele**: tab-ul Capcane (`CapcaneTab`), `MonteazaStepForm`, `VerificaStepForm`, graficul `GraficCapcane`, fișa `/tratamente/capcane/[grupId]`. „Fă un tratament” deschide formularul de tratament cu parcela aleasă. `src/components/capcane` și `src/lib/capcane` în `KIT_RULE_DIRS`. |
| `5d7bc64` | **Mementoul** în `notificari-dimineata` (`src/lib/capcane/memento-cron.ts`, `trimiteNotificareUtilizator`, cheia `capcane:<fermă>:<zi>:<utilizator>`) și **alerta** `POST /api/capcane/alerta` (recalculează pe server, doar proprietarului). Tipurile `capcane_verificare` / `capcane_peste_prag` în config, legături și iconița din Notificări. |
| `11a3abd` | **„Pragul la capcane”** și cele două comutatoare în Ce primești (operatorul nu vede „Capturi peste prag”); **cardul din Acasă** „Verificare azi · N capcane” → `/tratamente?tab=capcane&verifica=1`. |
| `ce70230` | **Registrul**: `documentRegistru` primește tabelele „Monitorizare cu capcane · grupurile” și „· capturi pe săptămâni”. |
| `6beb9cd` | **Demo nou** (`src/lib/demo/demo-capcane.ts`) și ștergerea capcanelor de pe parcelele demo la reîncărcare, înaintea parcelelor (cheia spre `parcele` e `ON DELETE RESTRICT`). |
| `9b70b1c` | **Smoke**, pasul 8: montează Drosophila pe Delniwa Sud → verifică 5 + 5 + 5 → „peste prag”; fără migrare se sare, cu motivul scris. Placa „Capcane” din formularul de tratament nu mai spune „în curând”, trimite la tab. |
| `a8c0afc` | Corecturi după testul în browser: insigna „peste prag” sub text pe listă (titlul se tăia pe telefon), starea grupului pe rândul de sus al fișei, avertizarea „Peste prag” din verificare mutată sub câmp (tastatura o ascundea). |
| `3bd4437` | Smoke, pasul 7 (Magazia, din promptul 28): locatorul „Din magazie” caută titlul (vezi secțiunea 6). |
| `cbe99c9` | `CLAUDE.md`: Capcanele. |

### Ce nu s-a făcut întocmai și de ce

- **Valorile de tip și de stare.** Tabelele vechi aveau verificări cu `drosophila_otet`, `lipicioasa_albastra`, `feromonala`, `altul` și `activ`, `scos`, `expirat`. Le-am înlocuit cu verificări care primesc și valorile noi (`drosophila` / `lipicioasa_galbena` / `feromoni` / `alta`, `activa` / `scoasa`), și pe cele vechi: e aditiv și nu strică nimic (tabelele sunt goale). Aplicația scrie doar valorile noi și le citește pe amândouă (`normalizeTip`, `normalizeStatus`). Starea implicită devine `activa`.
- **Unicitatea verificării.** Indexul unic e pe `(tenant_id, capcana_montata_id, client_sync_id, capcana_nr)`: aceeași cheie de formular acoperă toate capcanele din toate grupurile verificate deodată. Rândurile unui grup pleacă într-o singură inserare (toate sau nimic), deci `23505` înseamnă „grupul era deja salvat”.
- **„Peste prag” = capturile săptămânii ≥ prag × bucățile grupului** (în mockup, 3 capturi la 3 capcane sunt deja colorate ca peste prag). Săptămâna e luni–duminică și adună toate verificările din ea.
- **„În coacere”** folosește stadiul valabil în ziua verificării (ultimul observat până atunci, pe fiecare cohortă), nu doar stadiul de azi: altfel graficul ar colora și săptămânile vechi. Stadiile `parga` („Început de coacere”) și `maturitate` („Recoltare / fruct copt”). Fereastra culesului e deschisă după data estimată − 7 („de acolo încolo”). Estimarea vine din `estimeazaCules` (data pusă de mână, altfel prima recoltare de anul trecut).
- **„Am schimbat atractantul” e pe grup**, nu pe capcană: comutatorul apare la fiecare capcană a grupului, dar valoarea e una pentru tot grupul (atractantul se schimbă la toate odată), și se salvează pe fiecare rând.
- **„Verifică acum”** din tab verifică grupurile scadente; dacă nu e niciunul scadent, toate grupurile montate. Din fișă verifică doar grupul acela.
- **Alerta „Peste prag”** pleacă o dată pe grup și săptămână (cheia `capcane-prag:<grup>:<luni>`), ca a doua verificare din aceeași săptămână să nu te mai sune.
- **Cardul din Acasă** îl vede doar proprietarul: operatorii nu au acces la Acasă (`/dashboard`). Ei primesc push + notificarea în aplicație, cu legătura spre tab.
- **Pragul** stă în Notificări → Ce primești (prompt: „Setări → Notificări sau Setări → Ferma, unde se potrivește”), lângă comutatoarele capcanelor. Doar proprietarul îl vede și îl schimbă.
- **Pozele** merg în bucketul privat existent `capcane` (`<tenant>/montare-<cheie>.jpg`, `<tenant>/verificare-<cheie>-<grup>-<nr>.jpg`). Dacă poza nu se poate urca, capcanele / verificarea se salvează fără ea și ecranul de reușită spune asta.
- **Registrul** are doar săptămânile cu verificări (cele fără verificare apar pe grafic ca „–”).

## 2. Migrarea

Una singură: `supabase/migrations/20261123100000_capcane.sql`. Aditivă: 7 coloane noi (4 pe `capcane_montate`, 3 pe `capcane_verificari`), una pe `tenant_settings`, 2 indexuri unice parțiale, un index parțial, 4 verificări (2 noi, 2 lărgite), un trigger cu funcția lui, 2 politici de citire refăcute, 4 politici de storage (în locul a 3 care nu lăsau nimic). Nu atinge rânduri existente (sunt 0 rânduri în ambele tabele).

- **Ordinea**: după `20261122110000_analize_fructe.sql` (folosește `operator_can_read`), care e deja în producție. Față de celelalte migrări neaplicate, ordinea nu contează.
- **Aplicația merge fără ea** (verificat în demo): tab-ul Capcane spune „Capcanele vor merge după actualizarea bazei de date. Restul aplicației merge ca până acum.”, fără butoane; Acasă nu arată cardul; „Pragul la capcane” spune „Se poate schimba după actualizarea bazei de date”; registrul nu are secțiunea; cronul nu trimite nimic; seed-ul demo nu pune capcane. Singura urmă: cererea pe `capcane_montate` cu coloanele noi răspunde 400 (se vede în consola browserului ca „Failed to load resource”, pe care smoke îl ignoră).
- **Se aplică după merge.** Înainte de merge nu strică nimic (codul vechi nu folosește tabelele), dar nici nu folosește la ceva.
- Funcția triggerului e `SECURITY INVOKER` (rulează cu drepturile celui care inserează verificarea; aceeași regulă ca la modificarea grupului) și are `revoke execute … from public, anon`. Nu e RPC și nu e `SECURITY DEFINER`.

### Verificată fără să ating baza

Am rulat migrarea de două ori (e idempotentă) într-un Postgres în memorie (PGlite 0.2.17, Postgres 16), peste machete cu aceleași coloane, verificări, chei, indexuri și politici ca în producție, plus `auth.uid()`, `current_tenant_id()`, `is_tenant_owner()`, `operator_can_read/write()`, `storage.objects`, `storage.foldername()` și rolurile `anon` / `authenticated` / `service_role`. Rezultatul:

- proprietarul montează un grup Drosophila → starea implicită `activa`; aceeași cheie a doua oară → `23505`; tip necunoscut → refuzat; interval 0 → refuzat; valorile vechi (`feromonala`, `activ`) → acceptate;
- operatorul cu „Scrie” verifică 3 capcane (05.06, interval 4, atractantul schimbat) → grupul primește `data_urmatoarea_verificare = 09.06` și `data_schimb_atractant = 05.06`; aceeași cheie din nou → `23505`; o verificare mai veche (03.06) → datele nu dau înapoi; `capcana_nr = 0` → refuzat; „Scoate” (`scoasa`) → merge; `delete` → 0 rânduri;
- operatorul cu „Citește” vede grupurile, nu poate verifica (RLS);
- operatorul fără Tratamente → 0 grupuri, 0 verificări;
- proprietarul salvează pragul în `tenant_settings`;
- storage: proprietarul urcă în `<tenant>/…` → merge; în prefixul altei ferme → refuzat; operatorul cu „Citește” vede poza, nu urcă; operatorul fără Tratamente nu vede nimic;
- politicile vechi `capcane_*_own_tenant` au dispărut, au rămas cele 4 noi.

### SQL complet

```sql
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
```

## 3. Mementourile și alerta

- **„Verifică capcanele”** — în `/api/cron/notificari-dimineata` (05:00 UTC: 8:00 vara, 7:00 iarna), fără cron nou. Pentru fiecare fermă reală: grupurile active (service role, doar `select`); dacă unul e scadent (`data_urmatoarea_verificare ≤ azi`, sau montarea + intervalul când nu are dată), câte o notificare fiecărui destinatar: proprietarul și operatorii activi cu „Scrie” pe Tratamente (drepturile prin `resolveFarmMemberAccess`; cei cu „Citește”, fără Tratamente sau dezactivați nu primesc). Titlul „Verifică capcanele · 6 capcane”, textul „Maravilla 1, DELNIWA. Atractantul se schimbă azi la 2.” (a doua propoziție doar când e scadent). Cheia `capcane:<fermă>:<zi>:<utilizator>`: o dată pe zi și pe om, până se face verificarea (apoi triggerul mută data). Legătura: `/tratamente?tab=capcane`.
- **„Schimbă atractantul”** — în același mesaj. Implicit la 7 zile pentru Drosophila (de la montare sau de la ultima schimbare), `interval_atractant_zile` îl poate schimba; celelalte tipuri n-au atractant.
- **„Peste prag”** — `POST /api/capcane/alerta`, chemat de formular după salvare cu grupurile care au trecut. Serverul nu crede browserul: verifică sesiunea și dreptul (`resolveFarmActor` + `actorCanWrite('tratamente')`), citește grupurile fermei, verificările din săptămâna aceea, pragul și „în coacere” și recalculează. Trimite doar proprietarului: „Drosophila peste prag la Maravilla 1 (9 în 3 capcane)”, legătura spre `/tratamente/capcane/<grup>`. Cheia `capcane-prag:<grup>:<luni>`.
- **Liniștea 22–6 și preferințele**: toate trec prin `createNotification`, care oprește push-ul după comutator (`capcane` / `capcane_prag`) și după liniștea de noapte (`permitePush`, testat: 23:30 → fără push, 8:00 → push). Rândul din Notificări se creează oricum.
- **Cardul din Acasă**: „Verificare azi · N capcane”, cu parcelele și atractantul, „Verifică acum” deschide direct verificarea.

## 4. Testat în browser (demo nou)

Build de producție (`npm run build`, `next start`), panoul de browser. Întâi am verificat delogarea: panoul era încă în demo-ul de ieri; am ieșit (`leave-demo`), `/dashboard` → `/login`. Apoi demo nou din `/start` → „Continuă fără cont” → „Fructe de pădure”. **Tenantul: `e302eeed-67c3-4837-a282-e4e77fbc27e4`** (`guest+f10518ca…@demo.zmeurel.local`, creat la 07:43 UTC).

- **Fără migrare (starea reală)**: Tratamente → Capcane arată „Capcanele vor merge după actualizarea bazei de date”, Aplicări și Analize merg ca înainte, consola are doar 404-urile scripturilor Vercel (local) și 400-urile cererilor de capcane.
- **Cu baza simulată în browser** (am înfășurat `window.fetch` doar pentru `capcane_montate`, `capcane_verificari`, `tenant_settings.prag_capcane` și `/api/capcane/alerta`, cu datele seed-ului demo; nimic nu a plecat spre baza de date: la final, în producție, 0 grupuri, 0 verificări, 0 notificări de capcane), la 375 px:
  - tab-ul: cardul „Verificare azi · 3 capcane · Ultima: acum 7 zile. Atractantul se schimbă azi la 3.”, Maravilla „săptămâna trecută: 9 capturi · de verificat azi” cu „peste prag”, Delniwa Nord 0, Delniwa Sud 11;
  - fișa Maravilla: barele 0, 1, 3, 4, 9 (ultimele trei colorate), linia punctată la 3, 💧 la săptămâna 16 nov. (fertirigarea și stropirea demo), verificările „Luni 16.11 · 9 capturi (3, 4, 2) · atractant schimbat”;
  - „Verifică acum”: „Verificare · 1 din 3”, câmpul gol, comutatorul atractantului, 5 + 5 + 5 → la ultima capcană „Peste prag la Maravilla · Total 15 în 3 capcane săptămâna aceasta. Fructele sunt în coacere.” → salvarea a trimis 3 rânduri (aceeași dată, aceeași cheie, `prag_depasit`, `atractant_schimbat`) și cererea de alertă → rezumatul cu „Fă un tratament pe Maravilla” → formularul de tratament s-a deschis (închis fără salvare);
  - „+ Montează”: Drosophila → Delniwa Sud + Mure Thornfree → „Montează · 6 capcane” → 2 grupuri, cu chei diferite (`…3deb`, `…3dec`), următoarea verificare peste 7 zile;
  - „Scoate capcanele” → confirmarea → `status: scoasa`, fișa spune „Scoase”;
  - Acasă: cardul „Verificare azi · 3 capcane · Delniwa Nord.” → „Verifică acum” deschide verificarea grupului scadent (fără comutatorul atractantului, care nu era scadent); închiderea cu o valoare scrisă cere „Renunți la verificare?”;
  - Ce primești: „Verifică capcanele”, „Capturi peste prag”, „Pragul la capcane”; pornirea pragului la lipicioase a trimis toate tipurile, explicit;
  - Rapoarte → Exportă → Registrul de tratamente → Excel: fișierul are „Tratamente aplicate”, „Monitorizare cu capcane · grupurile” și „· capturi pe săptămâni”.
- Trei defecte găsite aici și corectate (`a8c0afc`), reverificate după al doilea build.

## 5. Ce n-am putut testa

- **Nimic pe baza reală cu migrarea aplicată** (n-am voie să o aplic): migrarea e verificată în PGlite, ecranele cu răspunsurile simulate. De verificat după aplicare: montarea și verificarea reale, triggerul, seed-ul demo (testat doar cu machete), reîncărcarea demo-ului cu capcane, pasul 8 din smoke.
- **Urcarea pozelor** în bucketul `capcane` (n-am făcut poze în panou; politicile sunt verificate în PGlite).
- **Cronul** (nu l-am apelat) și **ruta alertei** pe server (în browser era simulată): logica lor e acoperită de teste unitare, dar trimiterea reală și push-ul nu.
- **Vederea operatorului** (cu „Scrie” / „Citește”) nu am încercat-o în browser; drepturile sunt verificate în PGlite, destinatarii în teste.
- PDF-ul registrului (fereastra de tipărire); am verificat conținutul Excel, același HTML.

## 6. Verificări

| Verificare | Rezultat |
|---|---|
| `npm run lint` | 0 erori, 4 avertismente vechi (`chat-post-handler.ts`, `LivratorLivrariClient.tsx`, neatinse) |
| `npm run typecheck` | trece |
| `npm run check:kit` | trece, 297 de fișiere |
| `npm run test:critical:unit` | trece: 125 de fișiere, 1071 de teste (rulat cu `--maxWorkers=3`, cu serverul local oprit). Cu setarea implicită, pe mașina asta încărcată, au picat de fiecare dată alte teste, toate prin timeout de 5 s (`ComenziDinMesajSheet`, cronul de dimineață, kitul), deci nu din cauza codului; fiecare trece rulat singur |
| `npm run build` | trece (de două ori; mesajele „Dynamic server usage” de la paginile de Setări sunt cele obișnuite) |
| `npm run test:e2e:smoke` | 8 trec, 1 sărit: pasul 8 (Capcane), cu motivul „Migrarea 20261123100000_capcane.sql nu e aplicată” |

**Ce n-a mers din prima**: la prima rulare smoke a picat pasul 7 (Magazia, scris în promptul 28). Pasul se sărea până azi-dimineață, când a fost aplicată migrarea Magaziei, deci n-a rulat niciodată. Formularul arăta corect secțiunea „Din magazie”, dar `getByText('Din magazie')` prindea și paragraful „…scade din magazie…” (potrivire fără majuscule). Am schimbat locatorul pe titlu (`3bd4437`); a doua rulare a trecut. Cele două rulări au creat câte un demo nou (șterse de cronul de curățare), din care smoke a ieșit singur.

## 7. Commit-urile

```
cbe99c9 docs: CLAUDE.md — Capcanele (grupuri, verificări pe capcană, prag, „în coacere”, memento, alertă, registru)
3bd4437 test(e2e): smoke — pasul Magaziei caută titlul „Din magazie” (getByText prindea și „…scade din magazie”)
a8c0afc fix(capcane): după testul în browser — „peste prag” sub text pe listă (titlul rămâne întreg), starea grupului pe fișă, avertizarea din verificare deasupra tastaturii
9b70b1c test(e2e): smoke — pasul Capcanelor: montează → verifică peste prag → „peste prag” (se sare fără migrare); placa Capcane din formular trimite la tab
6beb9cd feat(capcane): demo nou cu 2 grupuri Drosophila (unul peste prag, verificarea azi) și lipicioase galbene; reîncărcarea le șterge înaintea parcelelor
ce70230 feat(capcane): registrul de tratamente cu secțiunea „Monitorizare cu capcane”
11a3abd feat(capcane): „Pragul la capcane” și comutatoarele în Ce primești; cardul „Verificare azi” în Acasă
5d7bc64 feat(capcane): mementoul „Verifică capcanele” în verificarea de dimineață (proprietar + operatori cu Scrie) și alerta „Peste prag” (doar proprietarul)
ab1dc0c feat(capcane): tab-ul Capcane în Tratamente, „+ Montează”, „Verifică acum” pe capcană, fișa grupului cu graficul pe săptămâni
dd88545 feat(capcane): stratul de date (grupuri, verificări pe capcană, pragul, pozele în bucketul capcane) și useCapcane cu „în coacere”
9789d78 feat(capcane): migrarea 20261123100000 (NEAPLICATĂ) și logica pură: prag, săptămâni, scadențe, „în coacere”, destinatari, memento, registru
```

Plus commit-ul acestui raport.
