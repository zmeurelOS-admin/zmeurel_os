# Raport — Promptul 20: Parcele și Lucrări (fostele Activități) pe kit

Branch: `redesign/parcele-lucrari` (din `main` `ebf6898`), cu push. Fără merge. Migrarea e scrisă, **neaplicată**.
Din baza de date am citit doar cu `select` (coloanele, constrângerile, indexurile, politicile RLS și declanșatoarele
pe `activitati_agricole`; `select distinct tip_activitate`; formatul din `operator`; constrângerile pe
`stadii_fenologice_parcela` și `configurari_parcela_sezon`; rândurile din demo-ul meu, după salvări). Testele manuale:
doar în conturi demo noi, create prin `/start` → „Continuă fără cont” → „Fructe de pădure” (browserul avea o sesiune
demo veche; am ieșit din ea cu `POST /api/auth/leave-demo`, care doar deloghează).

## Ce am schimbat, pe bucăți

| Commit | Ce |
|---|---|
| `124adbe` | **Migrarea** `20261121180000_lucrari_planificate.sql` (neaplicată), grupul `lucrariPlanificate` în `schema-features`, tipurile Supabase (`status`, `lot_id` opționale). |
| `4ed0655` | **Logica pură**, cu teste: `lib/lucrari/tipuri.ts` (cele 8 tipuri, maparea tipurilor vechi), `lib/lucrari/jurnal.ts` (gruparea pe salvare, Făcute / Planificate), `lib/lucrari/formular.ts` (un rând pe parcelă, cheia fiecăruia, „Cine”), `lib/parcele/semnal.ts` (pauză > planificat > stadiu), `lib/parcele/sezon-parcela.ts` (kg în sezon, kg/plantă, tratamente, ultima fertirigare), `lib/parcele/jurnal-parcela.ts` (jurnalul fișei pe zile), `lib/parcele/stadiu-curent.ts`. |
| `cc387df` | **Lucrări** `/lucrari`: Făcute / Planificate · N, banda „Stropirile și fertirigarea sunt acum în Tratamente →”, rânduri pe zile (lucrarea, parcelele, cine), foaia de detalii cu ⋯ (Editează / Șterge) și „Marchează făcut” la planificate; **„Lucrare nouă”** în 2 pași (`StepForm`). `/activitati-agricole` → redirecționare server la `/lucrari` cu toți parametrii. Legăturile: Mai mult (placa „Lucrări”), bara laterală, Acasă pe desktop (scurtătura „Lucrări”, widgetul vechi), prefetch (dashboard și bara de jos), „Vezi tratamentele pe teren” → `/tratamente`, analytics admin (`lucrari` → `activitati`), `FARM_MEMBER_MODULE_ROUTES` (`activitati`: `/lucrari`, `/activitati-agricole`, `/tratamente`; eticheta „Lucrări”; ruta implicită `/lucrari`). `getActivitatiAgricole` nu mai întoarce planificatele (după migrare). |
| `7b2976c` | **Lista de parcele** pe kit și **formularul de parcelă** (`ParcelaStepForm`, nou / editare). |
| `b667c3a` | **Fișa** `/parcele/[id]` (stadiul, pauza, Jurnal / Sezon, „+ Lucrare” / „+ Tratament”, meniul ⋯), **„Actualizează stadiul”** (`StadiuStepForm`), solarii: **culturile** (`CulturaStepForm`, „Desființează”) și **microclimatul** (`MicroclimatStepForm`), pliate. Demo „Fructe de pădure”: Maravilla remontantă + stadii (`lib/demo/demo-stadii.ts`). Componentele vechi șterse. Folderele în `KIT_RULE_DIRS`. |
| `02198e8` | **Tratamente**: `/tratamente?parcela=<id>` deschide formularul cu parcela aleasă (singura atingere în Tratamente). |
| `3440256` | **Acasă**: lucrările planificate pe azi la „De făcut azi”, cu „Marchează făcut” (telefon); sarcina „Palisare planificată: …” pe desktop; „Planificată: …” din extrasezon citește lucrările cu stare. |
| `20c2cd0` | e2e `activitati-solar.spec.ts` rescris pe Lucrări + fișă (nerulat: creează utilizatori cu service role). |
| `886767b` | Ajustări după trecerea prin demo: zmeura recunoscută și când cultura e scrisă cu soiul („Zmeure Maravilla”, cum e în demo) → pasul cu cohorta apare; cohorta nescrisă de două ori („După recoltare floricane”); data desființării în română. |
| *(acest commit)* | Raportul, `CLAUDE.md` (excepția veche cu `activitati-agricole/page.tsx` → Lucrări; lista modulelor din `check:kit`). |

### Ecranele (după capitolul 2 din `stoc-parcele-echipa.html`)

1. **Lista** (`/parcele`): un card pe parcelă — nume; „Zmeură Maravilla · 500 plante · 700 m²”; pastila „1.052 kg în 2026”
   (la cele personale: „Personal”, fără kg); **un singur semnal**: „Pauză până luni 23.11” (avertisment) > „Tratament
   planificat mâine” / „Tăiere planificată marți 24.11” (info; întârziat = avertisment) > stadiul curent („Post-recoltare”,
   verde). Filtrul „Toate · 7 / Câmp · 6 / Solar · 1” apare doar la mai multe tipuri. „+ Parcelă” jos (pe desktop, în pagină).
   Comercialele întâi, apoi după nume. `?selected=<id>` duce în fișă.
2. **Fișa** (`/parcele/[id]`): antet „Zmeure Maravilla · 2.000 plante · 4.000 m² · plantată 2024” (+ „· Personal”), ⋯ în
   dreapta; cardul stadiului („După recoltare floricane · După recoltare primocane”, „actualizat acum 4 zile”,
   „Actualizează”); banda de pauză („Pauză până luni 23.11 · Pauză 3 zile după Switch 62.5 WG, aplicat ieri. Mai sunt 2 zile.
   Recoltările de azi doar cu motiv.”); la solarii, „Culturi” (deschisă) și „Microclimat” (pliată); Jurnal / Sezon; jos
   „+ Lucrare” (formularul de lucrare cu parcela aleasă) și „+ Tratament” (`/tratamente?parcela=…`).
   - **Jurnal**, pe zile: „Recoltare 64 kg · 1 culegător” (adunate pe zi), „Stropire: Switch 62.5 WG + Kelpak · pauză 3
     zile”, tratamentele vechi „Fertirigare: NPK / Raizamix · importat”, „Lucrare: palisare · Vasile Popescu”,
     „Stadiu: După recoltare primocane”. Planificatele nu intră.
   - **Sezon**: Recoltat (kg, de la `inceputSezon`), Pe plantă, Tratamente în 2026 (noi + vechi, de la 1 ianuarie: stropirile
     de primăvară vin înaintea primei recoltări), Ultima fertirigare.
   - **⋯**: Editează · Microclimat (doar solarii) · Desființează cultura (câte un rând pe cultura activă din `culturi`; lipsește
     dacă nu e niciuna) · Șterge parcela (nu pentru operatori). Fiecare cu confirmare în foaie.
3. **Actualizează stadiul**: la remontante (configurarea de sezon `mixt_floricane_primocane` sau stadii pe cohorte deja)
   întâi „Pentru: Floricane / Primocane”, apoi plăcile din **lista canonică a culturii** (`listStadiiPentruGrup`, cu
   etichetele pe cohortă: „Floricane în repaus”, „Recoltare pe floricane” …); data azi (calendar în pas), notă opțională.
   Salvează prin `createParcelaStadiuCanonic` (ca până acum, cu `cohort`).
4. **Parcelă nouă / editare**: Nume, Tip (Câmp / Solar / Livadă / Cultură mare), Cultură + Soi pe pastile (+ „Alta” scrisă de
   mână; la solarii cultura se adaugă din fișă), Plante (Pomi la livadă), Suprafață, **Volum de soluție la o stropire (l)**,
   **Pentru: Comercial / Personal** (Experimental / Inactiv rămân dacă parcela le are). „Mai multe detalii”: situația
   operațională, statusul, an plantare, data plantării, rânduri, distanța, irigarea, „Apare în Acasă”, „Contribuie la
   producție”, locația (cu „Folosește locația de acum”), observații. Notele păstrează blocurile ascunse (`[zmeurel:…]`).
5. **Lucrări**: ca mockup-ul; rândul arată „Palisare · Delniwa Sud, Maravilla · Vasile Popescu” (+ nota, + „Planificată,
   întârziată” la cele rămase în urmă). „Altele” păstrează textul vechi sub titlu („Altele · Recoltare”).
6. **Lucrare nouă**: pasul 1 „Ce lucrare?” (8 plăci cu iconițe); pasul 2 „Unde și când?”: parcelele (pastile, „Toate
   parcelele”), Când (Azi / Altă zi / Planifică, calendar în pas), Cine (opțional: „Tu”, membrii echipei, culegătorii activi,
   sau „Alt nume”), Notă. Editarea folosește același formular (inclusiv schimbarea parcelelor).

## Migrarea (una singură; independentă de celelalte din 21.11)

`supabase/migrations/20261121180000_lucrari_planificate.sql` — SQL complet:

```sql
-- Lucrări (fostele Activități agricole, promptul 20): lucrările planificate și gruparea pe mai multe parcele.
-- Doar aditiv: două coloane nule, o constrângere pe valorile noi și două indexuri.
--
-- NEAPLICATĂ: o rulează Andrei, după merge. Independentă de celelalte migrări din 21.11.
-- Schema de pornire citită din producție pe 21.11.2026 (`information_schema.columns`, `pg_constraint`,
-- `pg_indexes`, `pg_policies`, `pg_trigger` pe `activitati_agricole`), nu din migrările vechi.
--
-- Ce adaugă:
--   * `activitati_agricole.status text null` — `'planificata'` = lucrare de făcut în ziua din `data_aplicare`;
--     `null` (toate rândurile de azi) sau `'facuta'` = făcută. „Marchează făcut” trece rândul pe `'facuta'` și
--     mută `data_aplicare` pe momentul marcării. Rândurile existente rămân `null`, deci făcute, neschimbate.
--   * `activitati_agricole.lot_id uuid null` — rândurile salvate împreună (aceeași lucrare pe mai multe parcele,
--     un rând pe parcelă, fiecare cu `client_sync_id` propriu) au același lot = cheia formularului. Jurnalul
--     Lucrări le arată pe un singur rând („Maravilla 1, Maravilla 2”). Rândurile vechi rămân fără lot.
--
-- Ce NU face: nu schimbă politici RLS (inserarea și modificarea cer deja
-- `is_tenant_owner(tenant_id) or operator_can_write('activitati')`, ștergerea doar proprietarul), nu adaugă
-- funcții (deci nici `revoke` / `grant`), nu atinge date existente, nu redenumește tipurile vechi de lucrări.
--
-- Până la aplicare, aplicația merge fără ele: Lucrări citește tot ca până acum (toate rândurile = făcute),
-- „Planifică” e dezactivat cu textul „Se activează după actualizarea bazei de date”, iar rândurile salvate
-- împreună se grupează după potrivire (aceeași zi, același tip, același „cine”, aceeași notă, salvate în
-- același minut).
--
-- Anulare (doar dacă e nevoie; pierde planificarea și lotul):
--   drop index if exists public.idx_activitati_agricole_tenant_planificate;
--   drop index if exists public.idx_activitati_agricole_tenant_lot;
--   alter table public.activitati_agricole drop constraint if exists activitati_agricole_status_check;
--   alter table public.activitati_agricole drop column if exists status, drop column if exists lot_id;

begin;

alter table public.activitati_agricole
  add column if not exists status text null,
  add column if not exists lot_id uuid null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'activitati_agricole_status_check'
      and conrelid = 'public.activitati_agricole'::regclass
  ) then
    alter table public.activitati_agricole
      add constraint activitati_agricole_status_check
      check (status is null or status in ('planificata', 'facuta'));
  end if;
end $$;

comment on column public.activitati_agricole.status is
  'Lucrări: ''planificata'' = de făcut în ziua din data_aplicare; null sau ''facuta'' = făcută.';
comment on column public.activitati_agricole.lot_id is
  'Rândurile salvate împreună (aceeași lucrare, mai multe parcele). Cheia formularului; null la cele vechi.';

-- Acasă și jurnalul citesc planificatele fermei.
create index if not exists idx_activitati_agricole_tenant_planificate
  on public.activitati_agricole (tenant_id, data_aplicare)
  where status = 'planificata';

create index if not exists idx_activitati_agricole_tenant_lot
  on public.activitati_agricole (tenant_id, lot_id)
  where lot_id is not null;

commit;

-- PostgREST: schema nouă se vede fără restart.
notify pgrst, 'reload schema';
```

„Cine” folosește coloana existentă **`operator`** (text liber; în producție 24 de rânduri au nume, niciunul nu e un id) —
nu e nevoie de coloană nouă. Proprietarul se scrie „Proprietarul” și i se arată „Tu”. „Volum de soluție” folosește
`parcele.volum_solutie_l` din migrarea Tratamente (deja aplicată în producție: am văzut coloana cu `select`).

### Ce merge fără migrare și ce nu

- **Merge tot**: lista, fișa, stadiul, formularul de parcelă (cu volumul, fiindcă migrarea Tratamente e aplicată), Lucrări,
  „Lucrare nouă” cu „Azi” / „Altă zi”, editarea, ștergerea, redirecționarea, „+ Tratament”.
- **„Planifică”** e dezactivat, cu „Planificarea nu e încă pornită · Se activează după actualizarea bazei de date. Până atunci
  poți nota lucrările făcute.” (verificat în demo: butonul „Planifică lucrarea” e inactiv).
- **Lucrările vechi cu dată în viitor** (fără stare) se socotesc planificate (așa le arăta și Acasă înainte). „Marchează
  făcut” merge pe ele și fără migrare (mută `data_aplicare` pe acum; după migrare pune și `status = 'facuta'`). Verificat
  în demo: „Tăiere · Mure Thornfree · marți 24.11” → făcută azi.
- **Gruparea pe mai multe parcele**: fără `lot_id`, după potrivire (aceeași zi, tip, cine, notă, stare, salvate la cel mult un
  minut, fiecare parcelă o singură dată). În demo, „Palisare” pe Delniwa Sud + Maravilla apare pe un rând; în bază sunt 2
  rânduri cu `client_sync_id` diferite. După migrare, gruparea e exactă, pe lot.
- **Acasă „De făcut azi”** primește lucrările planificate pe azi doar după migrare (fără ea nu se poate planifica pe azi).

Detectarea: `schema-features` (`select('status').limit(1)` pe `activitati_agricole`, o dată pe sesiune). Coloanele noi nu se
trimit niciodată cât lipsesc (nici în `select`, nici în `insert` / `update`).

## Maparea tipurilor vechi de lucrări pe cele 8 noi (doar la afișare)

`select tip_activitate, count(*) … group by 1` în producție (21.11), plus tipurile din vechea listă de opțiuni:

| Tip nou | Tipuri vechi (rândurile rămân neschimbate) |
|---|---|
| **Tăiere** | „Tăiere” (192), „taieri” (5), „Tăiere de formare” (1), „Tundere/Curatare” (1); din opțiunile vechi: „Tăiere lăstari”, „Tăiere de fructificare” (regula: conține „tai” / „tund” / „curat” / „defoli”) |
| **Palisare** | „palisat” (3), „Palisare” (1) |
| **Prășit / cosit** | „Prășit” (5); „Cosire” (regula: „pras” / „cosi” / „plivi”) |
| **Irigație** | „irigatie” (2); „Irigație” („irig” / „udat”) |
| **Mulcire** | „Mulcire” (4) |
| **Copilit** | „copilit” (3); „Ciupire/Cârnire” |
| **Legat** | „legat” (5) |
| **Altele** | „Altele” (5), „altele” (1), „Recoltare” (2) și orice alt text (din opțiunile vechi: „Semănat”, „Răsădit”, „Aerisire”, „Arat”, „Discuit”, „Transport”). Când textul spune mai mult decât „altele”, apare sub titlu („Altele · Recoltare”). |
| *nu sunt lucrări* (stau în Tratamente, „importate”) | „Fungicide/Pesticide” (386), „Fertirigare” (290), „Fertilizare foliară” (290), „tratament” (6), „fertigare” (3), „Stropire” (3), „Fertilizare de bază” (2), „Fertilizare” (1) — aceeași regulă ca în Tratamente (`tipDinActivitateVeche`) |

Lucrările noi se scriu cu eticheta: „Tăiere”, „Palisare”, „Prășit / cosit”, „Irigație”, „Mulcire”, „Copilit”, „Legat”, „Altele”.

## Ce funcții vechi am scos sau mutat

**Șterse** (înlocuite pe kit):
- `src/components/parcele/ParcelePageClient.tsx` (3.291 de linii: lista cu inspectorul de pe desktop, foaia de pe telefon cu
  file Rezumat / Activitate / Microclimat / Cultură, jurnalul cu filtre pe tip și perioadă), `AddParcelDrawer`,
  `EditParcelDialog`, `ParcelForm`, `ParcelFormSummary`, `ParcelUsageFields`, `AddCulturaDialog`, `CulturaFormSummary`,
  `AddMicroclimatDialog`, `MicroclimatAutoCard`, `DesfiinteazaCulturaDialog`, `ParcelaRezumatAgronomicChips`,
  `ParcelaStadiuCurentDisplay` (+ testele lor), `StickyActionBar` (parcele).
- `src/components/activitati-agricole/*` (formularul, combobox-ul, dialogurile de adăugare / editare) și vechea pagină
  `activitati-agricole/page.tsx` (706 linii; acum e doar redirecționarea).
- `src/lib/parcele/mobile-sheet-tabs.ts` și `src/lib/ui/app-select-maps.ts` (+ testele): le folosea doar pagina veche.

**Mutate / refăcute**:
- `formatStadiuFenologicLabel` / `formatStadiuFenologicCurentSummary` → `src/lib/parcele/stadiu-curent.ts` (fără React).
- `applyScopDefaults` → `implicitePentruScop` în `src/lib/parcele/formular-parcela.ts` (aceeași regulă).
- „Desființează cultura” și „Șterge parcela” → meniul ⋯ din fișă, cu confirmare în foaie (`desfiinteazaCultura` /
  `deleteParcela` neschimbate: ștergerea refuză parcelele cu recoltări sau activități).
- Culturile din solar și microclimatul → secțiuni pliate în fișă, cu aceleași câmpuri și aceleași funcții
  (`createCultura`, `desfiinteazaCultura`, `createSolarClimateLog`, vremea automată după coordonatele parcelei).

**Rămase deliberat**: `DeleteConfirmDialog` (folosit de Material săditor, nerefăcut; trecut în `KIT_RULE_PENDING_FILES`),
`lib/activitati/activity-options.ts` și `timeline.ts` (folosite de motorul dashboardului), `getActivitatiAgricole` (acum fără
planificate, după migrare).

**Ce nu mai există din ecranul vechi** (de știut): căutarea în lista de parcele (o fermă are câteva parcele; filtrul pe tip
rămâne), filtrele jurnalului pe tip / perioadă (jurnalul e acum complet, pe zile), istoricul vechi `etape_cultura` („Istoric
vechi” al culturilor din solar; tabelul rămâne, doar nu se mai afișează), stadiul pe fiecare cultură din solar (era tot stadiul
parcelei; acum e o dată, în cardul de sus), filtrele pe tip din vechea pagină Activități („Arhivate P&N” → Tratamente).

## Ce n-am putut testa

- **Nimic după migrare**: planificarea unei lucrări, „De făcut azi” în Acasă cu „Marchează făcut” pentru lucrări, sarcina de pe
  desktop, gruparea pe `lot_id`, editarea cu schimbarea stării. Logica e acoperită de teste unitare (stare, grupare pe lot,
  planificatele din zi, rândurile de salvat cu / fără migrare).
- **Operatorul** (drepturi parțiale: „Cine” fără lista echipei, fără ștergere) și **reîncercarea după o pierdere de rețea** la
  salvarea lucrării (cheile pe parcelă sunt aceleași la reîncercare; `creeazaLucrari` sare peste cele deja salvate).
- **e2e**: n-am rulat Playwright (testul creează utilizatori cu service role în baza de producție).
- **Ferma lui Andrei**: n-am deschis-o în aplicație; am citit doar cu `select` tipurile, formatul din `operator` și configurările
  de sezon (în producție există 3 configurări `mixt_floricane_primocane` și 12 stadii cu cohortă, deci pasul cu cohorta va apărea).
- **Demo-ul cu solar**: n-am creat un demo „Solarii”; culturile și microclimatul le-am încercat pe o parcelă Solar nouă în demo-ul
  „Fructe de pădure”.

## Verificarea în demo (390×844, zi și noapte; apoi 1280×800)

- Lista: „Post-recoltare” (Delniwa Nord, stadiu), „Tratament planificat mâine” (Delniwa Sud), „Pauză până luni 23.11”
  (Maravilla), „Tăiere planificată marți 24.11” (Mure Thornfree); Afine și Grădina casei „Personal”, fără kg. ✔
- Parcelă nouă „Solar test”: Solar, 84 m², volum 40 l, Personal → filtrul „Toate 7 · Câmp 6 · Solar 1” a apărut; fișa cu
  Culturi + Microclimat; cultură „Roșii” adăugată și desființată; microclimat 24 °C · 70%; editare (volumul 40 și „Personal” vin
  din bază), redenumire; ștergere → înapoi în listă. ✔
- Maravilla: stadiul pe cohorte; „Actualizează” → Floricane / Primocane → „După recoltare primocane” salvat (`cohort =
  primocane`); Jurnal (recoltări pe zi, stropirea cu pauză, fertirigarea, importatele, stadiul, palisarea) și Sezon. ✔
- Lucrare nouă „Palisare” pe Delniwa Sud + Maravilla, „Cine: Vasile Popescu” → un rând în Lucrări, 2 rânduri în bază, apare și în
  jurnalul Maravillei. „Planifică” fără migrare: blocat, cu mesajul. „Marchează făcut” pe o planificată veche. ✔
- `/activitati-agricole?openForm=1&tip=irigatie&parcela_label=Maravilla&observatii=20 min` → `/lucrari?…` (parametrii păstrați) →
  formularul la pasul 2 cu Irigație, Maravilla, nota „20 min”; adresa se curăță. `/parcele?selected=<id>` → fișa. ✔
- „+ Tratament” din fișă → Tratamente, formularul deschis; la „Stropire” Maravilla e deja aleasă. ✔
- Noaptea (lista, Lucrări, formularele) și ziua (fișa). 1280×800: lista, fișa (butoanele în pagină), bara laterală cu „Lucrări”. ✔

## Verificările

- `npm run lint`: 0 erori, 9 avertismente, toate în fișiere neatinse (chat, parse-order, livrator, două teste).
- `npm run typecheck`: curat.
- `npm run check:kit`: „OK — 223 fișier(e) verificate, fără abateri” (cu folderele Parcele și Lucrări adăugate).
- `npm run test:critical:unit`: 91 fișiere, 734 teste, toate trec (noi: `src/lib/lucrari/__tests__/lucrari.test.ts`,
  `src/lib/parcele/__tests__/parcela-fisa.test.ts`, `formular-parcela.test.ts`; actualizat `redesign-settings.test.ts`).
- `npm run build`: trece; `/lucrari`, `/parcele`, `/parcele/[id]`, `/activitati-agricole` în listă. (Mesajele
  „[setari] datele fermei nu s-au putut citi … Dynamic server usage” din build sunt din Setări / Mai mult, de dinainte.)
- `public/sw.js` (modificat dinainte în copia de lucru) nu e în niciun commit.

## De știut

- **Chatul AI** n-a fost atins: trimite tot la `/activitati-agricole?…`, redirecționarea duce mai departe. Sugestiile lui pe pagină
  (`AiBottomSheet`, cheia `'/activitati-agricole'`) nu mai apar pe `/lucrari`; un tip de tratament venit din chat („tratament”)
  duce la Tratamente cu mesajul „Stropirile și fertirigarea se notează acum în Tratamente.”
- **Echipa** n-a fost atinsă; „Cine” citește lista membrilor prin `GET /api/farm-members` (doar proprietarul o vede).
- **`src/lib/crops/crop-codes.ts`**: am adăugat „zmeure” → `zmeur` (pluralele celorlalte culturi erau deja acolo).

## Commit-urile

```
886767b fix(parcele): zmeura recunoscută și când cultura e scrisă cu soiul („Zmeure Maravilla”), cohorta nescrisă de două ori, data desființării în română
20c2cd0 test(e2e): activitati-solar pe Lucrări și fișa parcelei (redirecționarea din /activitati-agricole)
3440256 feat(acasa): lucrările planificate pe azi la „De făcut azi”, cu „Marchează făcut” (telefon) și în sarcinile de pe desktop
02198e8 feat(tratamente): /tratamente?parcela=<id> deschide formularul cu parcela aleasă (legătura „+ Tratament” din fișa parcelei)
b667c3a feat(parcele): fișa /parcele/[id] pe kit — stadiul, pauza, Jurnal și Sezon, „+ Lucrare” / „+ Tratament”, meniul ⋯; solarii: culturile și microclimatul pliate; componentele vechi șterse
7b2976c feat(parcele): lista pe kit (kg în sezon, un singur semnal, filtrul pe tip, „Personal”) și formularul de parcelă cu volum de soluție și Comercial / Personal
cc387df feat(lucrari): /lucrari pe kit — Făcute / Planificate, „Lucrare nouă” în 2 pași pe mai multe parcele, cu „Cine”; /activitati-agricole redirecționează cu parametrii păstrați
4ed0655 feat(parcele,lucrari): logica pură — cele 8 tipuri de lucrări, gruparea jurnalului, semnalul și sezonul pe parcelă, jurnalul fișei
124adbe feat(lucrari): migrarea aditivă pentru planificate și lot (neaplicată) + detectarea ei
```
