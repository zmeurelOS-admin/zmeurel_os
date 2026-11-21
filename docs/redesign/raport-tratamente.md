# Raport — Promptul 18: modulul Tratamente + „Șterge contul” reparat

Branch: `redesign/tratamente` (din `main` `b6c91c9`), cu push. Fără merge. Migrarea e scrisă, **neaplicată**.
Din baza de date am citit doar cu `select` (schema, constrângerile, indexurile, politicile RLS, `operator_can_write`,
`resolve_recoltare_stock_identity`, tipurile distincte din `activitati_agricole`, catalogul global). Testele manuale:
doar într-un cont demo nou, creat prin `/start` → „Continuă fără cont” → „Fructe de pădure” (browserul avea o sesiune
demo veche; am ieșit din ea cu `POST /api/auth/leave-demo`, care doar deloghează).

## Ce am schimbat, pe bucăți

| Commit | Ce |
|---|---|
| `6900033` | **GDPR**: `DELETE /api/gdpr/account` rulează întâi `deleteTenantScopedData(admin, tenantId, { scope: gdprFarmDelete, verifyCriticalTables: true })`, apoi analytics, `ai_conversations`, `tenants`, `profiles`, `auth.admin.deleteUser`. Protecțiile (cont protejat, step-up) rămân înainte. Test cu client simulat: ordinea apelurilor (lanțul de tratamente primul, `parcele` înainte de `tenants`, `auth` ultimul), oprirea la prima eroare critică (nu se atinge `tenants` / `profiles` / contul), contul protejat nu ajunge la nicio ștergere. |
| `48bffcf` | **Migrarea** `20261121160000_tratamente_modul.sql` (neaplicată), grupul `tratamenteLot` în `schema-features`, tipurile Supabase completate (coloanele noi opționale până la regenerare). |
| `9d3512f` | **Logica pură** (`src/lib/tratamente/`), cu teste: `pauza.ts` (sursa unică), `zile.ts` (ora României), `doze.ts`, `avertismente.ts`, `jurnal.ts`, `formular.ts`, `model.ts`; notificarea de dimineață (`zilnice/tratamente-azi.ts`) în cronul `notificari-dimineata`; comutatorul nou `tratamente` în „Ce primești”. |
| `274e168` | **Pagina `/tratamente`** (jurnal: Făcute / Planificate, filtre, pauzele sus, rânduri pe lot, „Importat”, foaia de detalii cu Repetă / Marchează făcut / Anulează planificarea) și **formularul pe pași** (`TratamentStepForm`), stratul de date (`queries/tratamente.ts`), `/tratamente` la modulul `activitati` pentru operatori, folderele noi în `KIT_RULE_DIRS`. |
| `20e1646` | **Mai mult** (rândul „Tratamente” sub Ferma, cu pastila de pauză) și **Acasă** (pauza din sursa unică, „De făcut azi” cu „Marchează făcut”; motorul dashboardului primește pauzele unificate, deci și desktopul). |
| `79c88bc` | **Recoltări**: pauza pe fiecare parcelă în pasul cu parcela, avertismentul cu „Alege altă parcelă” / „Recoltez totuși” + motiv; motivul în `observatii`. **Rapoarte**: exportul tratamentelor socotește pauza pe zile, în ora României. |
| `e9b6044` | **Demo** „Fructe de pădure”: 3 tratamente (stropire cu pauză activă, fertirigare A/B, planificată mâine), plante pe parcele; reîncărcarea demo-ului șterge întâi aplicările de pe parcelele demo (`parcela_id` e `ON DELETE RESTRICT`, altfel reîncărcarea s-ar opri). |
| `bcefbfe` | Ajustări după trecerea prin demo: pauzele multiple într-o singură casetă, un avertisment FRAC pe produs, rezumatul pe rânduri, butonul de pe desktop. |

### Ecranele (după mockup-ul `tratamente-v2.html`)

1. **Mai mult** → rândul „Tratamente” („Stropiri, fertirigare, pauză”) sub titlul Ferma, cu pastila „Pauză: Maravilla” (sau „Pauză: 3 parcele”). Plăcile rămân; bara de jos neschimbată.
2. **Acasă**: avertismentul de pauză sus („Maravilla: nu recolta până luni 23.11 · Pauză 3 zile după Switch 62.5 WG, aplicat ieri. Mai sunt 2 zile.”), duce la `/tratamente`; la „De făcut azi”, tratamentele planificate azi, cu „Marchează făcut”. Rândurile „Tratament: <parcelă>” (intervalul depășit) duc acum la `/tratamente`.
3. **Jurnalul**: „Noiembrie · N făcute · M planificate”, pauzele active, Făcute / Planificate · N, Toate / Stropiri / Fertirigare / Altele, zilele ca titluri, pastile cu parcelele și starea („Pauză până …”, „Fără pauză”, „Pauză … încheiată”, „Planificat”, „Planificat, întârziat”, „Importat”).
4. **Pas 1 „Ce faci?”**: „Repetă” (ultimul tratament făcut pe fiecare metodă) + plăcile Stropire, Fertirigare, La sol, Capcane (dezactivată, „în curând”).
5. **Stropire**: Unde (pastile), Soluție (propusă din parcele, editabilă), „Doza la 100 l” / „Doza la ha”, produsele în același rezervor (doza, cantitatea calculată, lichid / pulbere), avertismentele, „Pauză până la recoltare: 7 zile · Karate Zeon”. Primul produs alege modul după etichetă (la ha dacă eticheta are doar doza pe hectar); doza propusă = minimul de pe etichetă.
6. **Fertirigare**: produsele în g/plantă cu rezervorul A/B, parcelele bifabile cu „A 5 kg · B 5 kg” sau „nu azi”, totalul pe rezervor, nota despre calciu.
7. **Alege produsul**: căutare (nume sau substanță), „Folosite recent”, „Din catalog · pentru zmeur” (+ „Arată toate”), pastila de pauză, „Nu e în listă: scriu eu numele și pauza” (nume, tip, pauză).
8. **Pas 3 „Când”**: Făcut acum / Altă zi / Planifică (calendar în pas), fereastra meteo la „Făcut acum” (din `fetch-meteo`, câmpul `spray`), rezumatul (Unde · plante, Soluție, Produse câte unul pe rând, Pauză), „Nu recolta din … până <zi>” sau „Planificat <zi>”.
9. **Recoltări**: lista de parcele arată „Pauză până miercuri 25.11 · Fungicid demo 4”; alegerea unei parcele în pauză deschide avertismentul.

„La sol” e o metodă simplă (parcele + cantitatea totală pe produs, în kg sau l; `metoda_aplicare = 'fertilizare_baza'`),
fiindcă mockup-ul o are activă și jurnalul are „Altele”.

## Migrarea (una singură; ordinea: oricând, independentă de celelalte din 21.11)

`supabase/migrations/20261121160000_tratamente_modul.sql` — SQL complet:

```sql
-- Modulul Tratamente (promptul 18): coloane noi, toate nule, plus indexuri. Doar aditiv.
--
-- NEAPLICATĂ: o rulează Andrei, după merge. Independentă de celelalte migrări din 21.11.
-- Schema de pornire citită din producție pe 21.11.2026 (`information_schema.columns`, `pg_constraint`,
-- `pg_indexes`, `pg_policies`), nu din migrările vechi.
--
-- Ce adaugă:
--   * `aplicari_tratament.lot_id uuid null` — aplicările salvate împreună, pe mai multe parcele, au același lot
--     (cheia formularului, `form.clientSyncId`). Jurnalul arată un singur rând („Maravilla 1, Maravilla 2”).
--     Tot lotul e și cheia de idempotență: o reîncercare găsește aplicările deja create și nu le dublează
--     (index unic parțial pe `(tenant_id, lot_id, parcela_id)`). Aplicările vechi rămân fără lot și apar câte una.
--   * `aplicari_tratament_produse.rezervor text null` ('A' / 'B') — fertirigarea pe două rezervoare.
--   * `aplicari_tratament_produse.doza_g_per_planta numeric null` — doza la fertirigare, în grame pe plantă.
--   * `parcele.volum_solutie_l numeric null` — volumul de soluție obișnuit al parcelei la stropire. Se
--     completează singur la primul tratament pe parcelă (doar dacă e gol; nu se suprascrie) și se propune
--     la următoarele.
--
-- Ce NU face: nu schimbă politici RLS (cele existente acoperă coloanele noi: inserarea și modificarea
-- aplicărilor cer `is_tenant_owner(tenant_id) or operator_can_write('tratamente')`, parcele cer
-- `operator_can_write('parcele')`), nu adaugă funcții, nu atinge date existente.
--
-- Până la aplicare, aplicația merge fără ele: citirea nu cere coloanele noi, salvarea pe mai multe parcele
-- creează câte o aplicare pe parcelă (fără lot, deci câte un rând în jurnal și fără protecție la dublare),
-- fertirigarea păstrează g/plantă și rezervorul în `cantitate_text`, iar volumul nu se ține pe parcelă.
--
-- Anulare (doar dacă e nevoie, pierde lotul / rezervorul / volumul salvate):
--   drop index if exists public.aplicari_tratament_lot_parcela_key;
--   drop index if exists public.idx_aplicari_tratament_tenant_lot;
--   alter table public.aplicari_tratament drop column if exists lot_id;
--   alter table public.aplicari_tratament_produse drop column if exists rezervor, drop column if exists doza_g_per_planta;
--   alter table public.parcele drop column if exists volum_solutie_l;

begin;

alter table public.aplicari_tratament
  add column if not exists lot_id uuid null;

comment on column public.aplicari_tratament.lot_id is
  'Aplicările salvate împreună (același formular, mai multe parcele). Cheia formularului; null la cele vechi.';

create index if not exists idx_aplicari_tratament_tenant_lot
  on public.aplicari_tratament (tenant_id, lot_id)
  where lot_id is not null;

-- O parcelă apare o singură dată într-un lot: reîncercarea aceleiași salvări nu dublează.
create unique index if not exists aplicari_tratament_lot_parcela_key
  on public.aplicari_tratament (tenant_id, lot_id, parcela_id)
  where lot_id is not null;

alter table public.aplicari_tratament_produse
  add column if not exists rezervor text null,
  add column if not exists doza_g_per_planta numeric null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'aplicari_tratament_produse_rezervor_check'
      and conrelid = 'public.aplicari_tratament_produse'::regclass
  ) then
    alter table public.aplicari_tratament_produse
      add constraint aplicari_tratament_produse_rezervor_check
      check (rezervor is null or rezervor in ('A', 'B'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'aplicari_tratament_produse_doza_g_per_planta_check'
      and conrelid = 'public.aplicari_tratament_produse'::regclass
  ) then
    alter table public.aplicari_tratament_produse
      add constraint aplicari_tratament_produse_doza_g_per_planta_check
      check (doza_g_per_planta is null or doza_g_per_planta >= 0);
  end if;
end $$;

comment on column public.aplicari_tratament_produse.rezervor is 'Fertirigare: rezervorul A sau B.';
comment on column public.aplicari_tratament_produse.doza_g_per_planta is 'Fertirigare: grame de produs pe plantă.';

alter table public.parcele
  add column if not exists volum_solutie_l numeric null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'parcele_volum_solutie_l_check'
      and conrelid = 'public.parcele'::regclass
  ) then
    alter table public.parcele
      add constraint parcele_volum_solutie_l_check
      check (volum_solutie_l is null or volum_solutie_l >= 0);
  end if;
end $$;

comment on column public.parcele.volum_solutie_l is
  'Litri de soluție la o stropire pe toată parcela. Propus în formularul de tratament; null = necunoscut.';

commit;

-- PostgREST: schema nouă se vede fără restart.
notify pgrst, 'reload schema';
```

Nu adaugă funcții (deci nu e nevoie de `revoke` / `grant`) și nu schimbă politici RLS: am verificat cu `pg_policies`
că `produse_fitosanitare_insert` permite deja produsul fermei (`tenant_id = current_tenant_id() and (is_tenant_owner
or operator_can_write('tratamente'))`), iar aplicările și produsele lor au deja insert / update pentru proprietar și
operatorul cu `tratamente`. În demo, „Nu e în listă” a creat produsul fără nicio migrare.

### Ce merge fără migrare și ce nu

Merge tot ecranul și toată salvarea. Diferențele până la aplicare:

- **Gruparea pe mai multe parcele**: fără `lot_id`, un tratament pe 2 parcele se salvează corect (o aplicare pe parcelă), dar jurnalul îl arată pe 2 rânduri, iar „Repetă” reia doar rândul ales (o parcelă). După migrare: un rând, „Maravilla, Delniwa Sud”.
- **Protecția la dublare**: fără lot nu există o cheie pe server. Dacă produsele nu se pot salva după aplicări, aplicările tocmai create se șterg (încercare; operatorii nu au `DELETE`). După migrare: reîncercarea găsește aplicările după lot și nu le dublează (index unic `(tenant_id, lot_id, parcela_id)`), iar produsele se adaugă doar unde lipsesc.
- **Fertirigarea**: g/plantă și rezervorul se scriu oricum în `cantitate_text` („2 g/plantă · rezervor A”) și se citesc de acolo (jurnal, Repetă); după migrare, și în `doza_g_per_planta` / `rezervor`.
- **Volumul de soluție pe parcelă**: fără coloană, câmpul pornește gol și nu se ține minte.
- Cronul de dimineață citește `lot_id` dacă există; altfel numără aplicările (câte una pe parcelă).

Detectarea: `schema-features` (`select('lot_id').limit(1)` pe `aplicari_tratament`, o dată pe sesiune); coloanele noi nu
se trimit niciodată cât lipsesc.

## Cum am grupat aplicările pe mai multe parcele

O aplicare = o parcelă (schema existentă). Un tratament salvat pe mai multe parcele = mai multe rânduri în
`aplicari_tratament` cu același `lot_id` = cheia formularului (`form.clientSyncId` din `useStepForm`, aceeași la
reîncercare, alta la următoarea deschidere). Jurnalul grupează după `lot_id` (+ status); aplicările fără lot (cele
vechi, inclusiv cele ale fermei lui Andrei) apar câte una, netransformate. Produsele unei aplicări sunt în
`aplicari_tratament_produse` (`ordine` 1..n: mai multe produse în același rezervor). Antetul aplicării cere fie
`produs_id`, fie `produs_nume_manual` (constrângerea `aplicari_tratament_produs_xor_check`): primește primul produs.

Cantitatea unei stropiri se împarte pe parcele (la 100 l: după volumul salvat al parcelelor, altfel după suprafață;
la ha: exact după suprafață), ca suma rândurilor să dea cât ai pus în rezervor; jurnalul adună produsele pe lot.
Fertirigarea: kg pe parcelă = g/plantă × `nr_plante` / 1000. Stocul nu se atinge (`stoc_mutatie_id` gol); planurile
pe stadii (`planuri_tratament*`) nu se ating.

**Volumul de soluție** (varianta simplă): se învață la primul tratament pe parcelă. După o stropire „la 100 l”,
parcelele fără volum primesc partea lor (restul peste volumele știute, împărțit după suprafață); un volum existent nu
se suprascrie. Propunerea = suma volumelor parcelelor alese; dacă una nu are volum, câmpul pornește gol. N-am atins
fișa / formularul parcelei (ecranele vechi rămân cum sunt).

## Unde stă motivul recoltării în pauză

În `recoltari.observatii`, bloc ascuns
`[zmeurel:recoltare-pauza]{"motiv":"consum_propriu","panaLa":"2026-11-25","produs":"Fungicid demo 4"}[/zmeurel:recoltare-pauza]`,
lângă `[zmeurel:harvest-crop]`, prin `buildHarvestObservatii(notă, cultură, pauză)` din `lib/parcele/crop-config.ts`.
Motive: `consum_propriu` („Pentru consum propriu”), `fructe_aruncate`, `altceva`. Am ales varianta asta fiindcă nu
schimbă semnătura RPC-ului `create_recoltare_idempotent` și nu cere migrare; `resolve_recoltare_stock_identity`
citește doar blocul harvest-crop (regex nelacom între marcaje, verificat cu `pg_get_functiondef`).
`stripHiddenAgricultureMetadata` ascunde și blocul nou, deci nota vizibilă rămâne curată. La editare, pe aceeași
parcelă, motivul vechi se păstrează. Verificat în demo cu `select`: recoltarea de 2 kg din Delniwa Nord are blocul.

Comportamentul: pauza se judecă în **ziua recoltării** (o recoltare trecută nu e în pauză din cauza unui tratament de
după ea). La o recoltare nouă, „Salvează” pe o parcelă în pauză fără motiv deschide întâi avertismentul. Doar
avertizare, nu blocare.

## Pauza: o singură sursă

`src/lib/tratamente/pauza.ts` combină aplicările noi cu `status = 'aplicata'` (pauza = cea mai lungă
`phi_zile_snapshot`; aplicările vechi din plan fără produse: `phi_zile` al produsului din antet) și activitățile vechi cu
`timp_pauza_zile > 0`. Zilele se socotesc în ora României (`ziuaRo`, `Europe/Bucharest`): stropit pe 15.07 cu pauză 3 zile
→ prima zi permisă 18.07. Folosit de: Recoltări (formularul), Acasă pe telefon (caseta) și pe desktop (motorul
`buildParcelDashboardStates` primește `pauzePeParcela`), Mai mult (pastila), jurnalul, Rapoarte (exportul, pe zile, ora
României). Teste: aplicare nouă, activitate veche, ambele, expirată, ora României (22:30 UTC = ziua următoare), doar
aplicările făcute, recoltare din trecut.

## Notificarea

- Tip nou `tratament_planificat`, în cronul existent `notificari-dimineata` (fără cron nou): o notificare pe fermă,
  „2 tratamente planificate azi” (un tratament = un lot), deduplicată prin `data.reminder_key = tratament:<tenant>:<zi>`.
- Cheia de preferință: **una nouă, `tratamente`** („Tratamente planificate · Dimineața, în ziua lor”), cu rândul ei în
  „Ce primești” (8 comutatoare acum). N-am folosit `pauza`: aceea anunță când se poate culege din nou, e alt lucru;
  cine oprește una nu vrea neapărat s-o oprească pe cealaltă. Nu cere migrare (`notificari_preferinte.tipuri` e jsonb).
- Atingerea notificării duce la `/tratamente?fila=planificate`.

## Activitățile vechi

`select distinct tip_activitate` (21.11): tratamente = „Fungicide/Pesticide”, „Fertirigare”, „Fertilizare foliară”,
„tratament”, „fertigare”, „Stropire”, „Fertilizare de bază”, „Fertilizare”. Apar în jurnal „Importat”, doar citire
(foaia spune „Importat din Activități … îl schimbi din Activități”), netransformate. Prășitul, tăierile, legatul etc.
nu apar. Fertirigare / fertigare → Fertirigare; Fertilizare de bază / Fertilizare → La sol (filtrul „Altele”); restul →
Stropire.

## Operatorii

`/tratamente` nu era în nicio rută de modul (operatorii ar fi fost trimiși înapoi). L-am pus la modulul `activitati`
(`FARM_MEMBER_MODULE_ROUTES`): operatorul cu Activități vede jurnalul și rândul din Mai mult. Scrierea o decide baza de
date (`operator_can_write('tratamente')`); dacă e refuzată, mesajul e „Nu ai drept de scriere pe tratamente”. Echipa
(alegerea modulelor) n-am atins-o: `tratamente` nu e încă în `FARM_MEMBER_MODULES` (de făcut odată cu ecranul Echipei).

## Demo

Seed-ul „Fructe de pădure” (cod) adaugă: stropire ieri pe Maravilla (Switch 62.5 WG + Kelpak, din catalogul global,
pauză 3 zile → activă), fertirigare acum 3 zile pe Delniwa Nord / Sud / Maravilla (Ferti 15-5-30 rezervor A + Calcinit
rezervor B, 2 g/plantă), stropire planificată mâine (Serenade ASO, Maravilla + Delniwa Sud). Parcelele de fructe de
pădure primesc `nr_plante`. O eroare aici nu oprește demo-ul. Verificat creând un demo nou.

## Verificarea în demo (390×844, apoi 1280×800)

- Mai mult → Tratamente, cu pastila „Pauză: Maravilla”. ✔
- Jurnalul cu Făcute / Planificate, filtrele (Altele gol, Fertirigare), rânduri „Importat”, foaia de detalii. ✔
- Stropire nouă pe Maravilla + Delniwa Sud cu 3 produse: la ha (Switch 1 kg/ha × 0,7 ha = 700 g, Karate 105 ml), apoi la
  100 l cu 200 l (Switch 200 g, Karate 30 ml, Kelpak 500 ml); pauza = 7 zile (Karate Zeon, cea mai lungă); avertismentul
  FRAC (Switch după Switch: „Grupa FRAC 9 și 12, de două ori la rând”), intervalul minim, meteo („Vânt prea mare”). Salvată. ✔
- Fertirigare pe 3 parcele (din „Repetă” + bifat celelalte), 2 g/plantă A/B: A 5 / 3 / 4 kg, total A 12 kg · B 12 kg. Salvată. ✔
- „Repetă” din pasul 1 (fertirigarea). ✔
- Produs nou prin „Nu e în listă” (pauză 4 zile), planificat azi → Acasă la „De făcut azi” → „Marchează făcut” → pauza
  apare în Acasă („Delniwa Nord: nu recolta până miercuri 25.11”) și în Recoltări. ✔
- Recoltare din Delniwa Nord în pauză → avertisment → „Recoltez totuși” → „Pentru consum propriu” → salvată, motivul în
  `observatii` (verificat cu `select`). ✔
- Noaptea (Acasă, Mai mult, jurnal, formularul, Recoltări) și ziua (jurnalul). ✔
- 1280×800: jurnalul (cu butonul în pagină) și dashboardul desktop („3 parcele în pauză de tratament”). ✔

## Ce n-am putut testa

- **Nimic după migrare**: gruparea pe lot în jurnal, idempotența pe lot, rezervor / g/plantă în coloane, volumul învățat
  pe parcelă, cronul cu `lot_id`. Sunt acoperite de teste unitare pe funcțiile pure, nu în aplicație.
- **Cronul `notificari-dimineata`** nu l-am apelat (interzis); `tratamentePlanificateAzi` are test unitar.
- **Ștergerea GDPR** doar cu client simulat (nicio ștergere reală).
- **Operatorul** (drepturi parțiale) și **reîncercarea după o pierdere de rețea** la salvarea tratamentului.
- **Demo-ul cu migrarea aplicată** (seed-ul trimite lot / rezervor doar dacă există coloanele).
- Datele reale ale fermei lui Andrei nu le-am deschis în aplicație (doar `select`); jurnalul le citește prin aceeași cale
  ca demo-ul (aplicări cu și fără produse, din plan, cu metodă nulă), acoperită de teste.

## Verificările

- `npm run lint`: 0 erori, 10 avertismente, toate în fișiere neatinse (chat, parse-order, livrator, parcele, două teste).
- `npm run typecheck`: curat.
- `npm run check:kit`: „OK — 168 fișier(e) verificate, fără abateri” (cu folderele Tratamente adăugate).
- `npm run test:critical:unit`: 85 fișiere, 645 teste, toate trec (noi: `src/lib/tratamente/__tests__/*`, GDPR
  `account-cleanup-order.test.ts`, preferințele cu `tratamente`).
- `npm run build`: trece; `/tratamente` e în listă.
- `public/sw.js` (modificat dinainte în copia de lucru) nu e în niciun commit.

## Commit-urile

```
bcefbfe fix(tratamente): ajustări după trecerea prin demo
e9b6044 feat(demo): demo-ul „Fructe de pădure” vine cu tratamente
79c88bc feat(recoltari): pauza din sursa unică, avertismentul cu „Recoltez totuși” și motivul
20e1646 feat(tratamente): Mai mult → Tratamente, Acasă cu pauza unică și „De făcut azi”
274e168 feat(tratamente): pagina /tratamente și formularul pe pași
9d3512f feat(tratamente): logica pură — pauza unică, doze, avertismente, jurnal, notificarea de dimineață
48bffcf feat(tratamente): migrarea aditivă a modulului (neaplicată) + detectarea ei
6900033 fix(gdpr): ștergerea contului curăță întâi datele fermei, în ordinea cheilor
```
