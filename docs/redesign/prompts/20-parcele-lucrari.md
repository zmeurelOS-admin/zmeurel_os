# Prompt 20 — Parcele și Lucrări (fostele Activități) pe kit

Model: Opus 5.5 · Effort: high · Mod: normal (fără plan) · Sesiune: NOUĂ · Branch: `redesign/parcele-lucrari` (pornit din `main` `ebf6898`) · Rezultat: branch verde, cu push, fără merge

## Cum lucrezi

- Lucrezi singur, fără plan și fără să ceri aprobare. Ce te blochează sari, notezi în raport și continui.
- Commit-uri mici, pe bucăți logice (lista de parcele, fișa, stadiul, formularul, lucrările, Acasă), cu push după fiecare. Logica (semnalul pe parcelă, sezonul pe parcelă, gruparea jurnalului) stă în funcții pure, cu teste.
- Pe kit (`src/components/kit`), cu regulile din `CLAUDE.md`. Model: Recoltări și Tratamente. Adaugi folderele în `KIT_RULE_DIRS`.
- Migrările le scrii, **nu le aplici**; doar aditive. Aplicația merge și înainte de migrare (citirea nu cade, scrierea spune „se activează după actualizarea bazei”). Înainte de orice migrare citești schema reală cu `select`.

## Mockup-ul aprobat

`git show origin/redesign/prompturi-11-12:docs/redesign/mockups/stoc-parcele-echipa.html > /tmp/mockup.html`, capitolul **2 · Parcele și Lucrări** (Lista de parcele, Fișa parcelei, Actualizează stadiul, Parcelă nouă / editare, Lucrări, Lucrare nouă). Urmezi ecranele și textele. Cifrele sunt de exemplu.

## Deciziile lui Andrei (21.11, toate recomandările acceptate)

1. **Solar, Livadă, culturile multiple (`culturi`, la solarii) și microclimatul** (`solar_climate_logs`) trec pe kit **cu aceleași câmpuri și aceleași funcții**, nu se regândesc. Microclimatul stă într-o secțiune pliată în fișa parcelei (doar unde are sens, la solarii).
2. **Parcelele personale** (`rol = 'personal'`) apar în listă cu eticheta „Personal”, **fără kg și venit**.
3. **„Desființează cultura” și ștergerea parcelei** se mută în meniul ⋯ din fișă, cu confirmare (`DeleteConfirmDialog` / `DesfiinteazaCulturaDialog` refăcute pe kit; logica rămâne).
4. **„Activități agricole” se redenumește „Lucrări”**: tăiere, palisare, prășit/cosit, irigație, mulcire, copilit, legat, altele. Tratamentele (stropiri, fertilizări, fertirigare) stau în **Tratamente**; tipurile de tratament nu mai apar la „Lucrare nouă”. Activitățile vechi de tip tratament rămân în tabel și se văd în Tratamente ca „importate” (deja făcut în 18); în Lucrări apar doar lucrările.
5. **„Cine” opțional** la lucrare (proprietarul, un membru al echipei, un culegător), fără ore. Folosești coloana existentă `activitati_agricole.operator` (text) dacă se potrivește; altfel coloană nouă nulă.

## Ce faci

### Rute
- **Lucrări:** ruta nouă `/lucrari`; `/activitati-agricole` redirecționează la `/lucrari` **păstrând parametrii din URL** (chatul AI trimite precompletări acolo, iar legăturile lui trebuie să meargă mai departe). Actualizezi legăturile din Mai mult, Acasă (telefon și desktop), prefetch, și maparea rutelor operatorilor (`FARM_MEMBER_MODULE_ROUTES`: modulul `activitati` acoperă și `/lucrari`; eticheta modulului devine „Lucrări”). Cheia modulului din bază **nu** se schimbă.
- **Fișa parcelei:** pagină proprie `/parcele/[id]` (azi e o redirecționare spre `/parcele?selected=`); vechiul `?selected=` redirecționează spre fișă.

### Lista de parcele (`/parcele`)
- Câte un card: nume, cultură + soi, plante, suprafață, kg în sezon (sezonul = `inceputSezon`; la cele personale fără kg) și **un singur semnal**, în ordinea: pauză (din `src/lib/tratamente/pauza.ts`) > tratament sau lucrare planificată > stadiul curent.
- Filtrul pe tip (Câmp / Solar / Livadă / …, din `tip_unitate`) apare **doar dacă ferma are mai multe tipuri**.
- „+ Parcelă” → formularul.

### Fișa parcelei (`/parcele/[id]`)
- Antet: nume, cultură, soi, plante, suprafață, an de plantare; meniul ⋯ (Editează, Microclimat la solarii, Desființează cultura, Șterge parcela).
- Stadiul curent cu „Actualizează”; banda de pauză dacă e cazul.
- File **Jurnal** (tot ce s-a întâmplat pe parcelă, pe zile: recoltări, tratamente noi și vechi, lucrări, stadii) și **Sezon** (kg recoltate, kg/plantă, câte tratamente, ultima fertirigare).
- Jos: „+ Lucrare” (formularul de lucrare cu parcela aleasă) și „+ Tratament” (`/tratamente` cu parcela precompletată).
- La solarii: culturile din `culturi` (adaugă / desființează) și microclimatul, pliate, cu aceleași funcții ca azi.

### Stadiul
- Foaie / pas: pentru soiurile remontante (configurarea existentă din `src/lib/parcele/configurare-sezon.ts`, `fenofaza-curenta-parcela.ts`) alegi întâi cohorta (floricane / primocane), apoi stadiul din **lista canonică a culturii** (`src/lib/parcele/stadii-canonic.ts`), ca plăci; data azi implicit. Salvezi în `stadii_fenologice_parcela` (cu `cohort`), cum se face azi. Lista de stadii din mockup e doar ilustrativă; folosești lista reală.

### Formularul de parcelă (nou / editare)
- Pe kit, aceleași câmpuri ca azi (nume, tip, cultură, soi, plante, suprafață, rânduri, irigare, data plantării etc.; câmpurile rar folosite pot sta sub „Mai multe detalii”), plus **„Volum de soluție la o stropire”** (`parcele.volum_solutie_l`, din 18) și **„Pentru: Comercial / Personal”** (`rol`). Înlocuiește `AddParcelDrawer` / `EditParcelDialog` / `ParcelForm`.

### Lucrări (`/lucrari`)
- File **Făcute / Planificate**; rânduri pe zile: lucrarea, parcelele, cine. Bandă scurtă: „Stropirile și fertirigarea sunt acum în Tratamente →”.
- Doar tipurile de lucrare (nu tratamentele). Tipurile vechi scrise diferit (`taieri`, `Tăiere`, `Tăiere de formare`, `palisat`, `Palisare`, `irigatie`, `legat`, `copilit`, `Tundere/Curatare`, `Prășit`, `Mulcire`, `altele`, …; verifici lista reală cu `select distinct`) se mapează pe cele 8 tipuri noi doar **la afișare**, fără să modifici rândurile.
- **„Lucrare nouă”** în 2 pași (`StepForm`): (1) tipul, plăci; (2) parcelele (una sau mai multe), când (azi / altă zi / planifică), cine (opțional), notă. Pe mai multe parcele: câte un rând pe parcelă (cum e tabelul), cu `client_sync_id` pe fiecare.
- **Planificatele:** `activitati_agricole` n-are azi stare. Coloană nouă nulă (de ex. `status text` cu `planificata` / null = făcută, sau `planificata boolean`), aditivă. Planificatele apar în Acasă la „De făcut azi” în ziua lor, cu „Marchează făcut” (ca tratamentele).
- Editarea și ștergerea unei lucrări rămân (foaie de detalii cu ⋯).

### Acasă
- „De făcut azi” primește și lucrările planificate pe azi (lângă tratamente și comenzi).

## Ce NU faci

- Mediul local folosește **baza de PRODUCȚIE**. Din bază doar citești (`select`). Testele manuale se fac **doar într-un cont demo nou**.
- Nu aplici migrări, nu apelezi cronuri, nu schimbi variabile de mediu.
- Nu atingi `public/sw.js` și nu slăbești `.claude/settings.json`.
- Nu modifici rândurile existente din `activitati_agricole`, `parcele`, `culturi`, `stadii_fenologice_parcela` (nici normalizări de tip). Nu atingi Tratamente (doar legătura cu parcela precompletată), Echipa (vine în 21), Asociația, chatul AI (în afară de redirecționarea care trebuie să-i păstreze legăturile).

## Verificare în demo (la final), la 390×844, zi și noapte

- Lista: semnalele (pauză, planificat, stadiu), filtrul pe tip, o parcelă personală fără kg.
- Fișa: Jurnal și Sezon, actualizarea stadiului (cu cohortă la remontante), meniul ⋯ (fără să ștergi nimic real; ștergerea o testezi pe o parcelă nouă, creată în demo).
- Parcelă nouă cu volum de soluție și „Personal”; editare.
- Lucrare nouă pe 2 parcele, cu „Cine”; o lucrare planificată pe azi → apare în Acasă → „Marchează făcut”.
- `/activitati-agricole?…` duce la `/lucrari` cu parametrii păstrați.
- O trecere la 1280×800.

## Raportul

- ce ai schimbat, pe bucăți, cu commit;
- migrarea, cu SQL complet; ce merge fără ea;
- maparea tipurilor vechi de lucrări pe cele 8 noi;
- ce funcții vechi ai scos sau mutat;
- ce n-ai putut testa;
- verificările: lint, typecheck, check:kit, test:critical:unit, build;
- lista commit-urilor, cu hash.

NEVER delete, truncate, or modify any user data in the database. Do not run DELETE, UPDATE, or TRUNCATE on production data tables. Do not reset or seed over existing data.
