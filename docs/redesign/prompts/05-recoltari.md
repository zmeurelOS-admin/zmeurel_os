# Prompt 05 — Faza 3: Recoltări pe kit (modul pilot)

Model: Fable 5.2 · Effort: high · Mod: plan · Sesiune: NOUĂ · Branch: `redesign/recoltari` (existent, din `main` + acest prompt) · Rezultat: pagina `/recoltari` refăcută pe kit, conform mockup-ului aprobat

## Protocol de lucru (obligatoriu)

1. **PLAN** — citește acest fișier, `CLAUDE.md`, `docs/redesign/tokens.md`, `docs/redesign/mockups/recoltari.md` (deciziile lui Andrei), `docs/redesign/progres.md` (secțiunea „Rămase”), kitul (`src/components/kit/index.ts` și pagina `src/app/(dashboard)/admin/kit/`, în special formularul demonstrativ „Adaugă kg”) și codul actual al modulului (lista de mai jos). Trimite:
   - inventarul funcțiilor existente (filtre de perioadă, căutare, filtre parcelă/culegător, interval de date, zile expandabile, vizualizare, editare, ștergere cu anulare, precompletare din chat AI prin URL, sincronizarea manoperei) și, pentru fiecare: **păstrat / mutat unde / eliminat**, cu motiv;
   - structura ecranelor (listă azi → pasul 1 culegător → pasul 2 kg → verificare/salvare), cu componentele de kit folosite pe fiecare;
   - cum rezolvi cele două butoane de la pasul 2 pe un ecran de 390×800 (vezi „Pasul 2”);
   - cum previi dublarea unei recoltări la dublu-tap sau la reîncercare (vezi „Idempotență”) — cu ce ai găsit în schemă, fără să schimbi nimic;
   - ce faci pe desktop (vezi „Desktop”);
   - lista exactă de fișiere create / modificate / șterse;
   - cum verifici salvarea fără să atingi datele reale (vezi „Verificare”);
   - împărțirea pe cele două etape de mai jos.
   **STOP. Aștepți aprobarea.**
2. **ETAPA A** (lista de azi + adăugarea) — după „aprobat”. Commit-uri mici. La final: push, raport scurt, link de preview, ce să verifice Andrei pe telefon. **STOP. Aștepți „continuă”.**
3. **ETAPA B** (vizualizare, editare, ștergere, zile anterioare, curățenie) — după „continuă”. La final: push, raport, link de preview, lista de verificat pe telefon, `progres.md` actualizat. **STOP. Fără merge.**

## Context

Fundația și kitul sunt în `main`. Recoltări e **primul modul refăcut pe kit**: ce stabilim aici devine modelul pentru Comenzi și Livrări. Mockup aprobat: https://claude.ai/artifact/NfqZJG7nTanjryxB3r191R — deciziile sunt scrise în `docs/redesign/mockups/recoltari.md` și au prioritate față de mockup acolo unde diferă.

Cod actual:
- `src/app/(dashboard)/recoltari/` (`page.tsx`, `RecoltariPageClient.tsx` ~1050 rânduri, `loading.tsx`, `error.tsx`)
- `src/components/recoltari/` (`AddRecoltareDialog`, `EditRecoltareDialog`, `ViewRecoltareDialog`, `RecoltareFormSummary`)
- `src/lib/supabase/queries/recoltari.ts` (RPC-urile `create_/update_/delete_recoltare_with_stock` + `scheduleAutoManoperaSync`), `src/lib/supabase/queries/culegatori.ts`
- `src/lib/recoltari/` (`aggregate-by-culegator`, `list-view`, `parcela-link`) și testele lor

## Ce construiești

### Pagina — doar azi
- Antet de pagină (`PageHeader` existent) cu titlul „Recoltări” și data de azi.
- **`StatHero`** sus: total kg azi (mare), plus lei de plată, calitatea 1, calitatea 2, număr culegători.
- Lista **celor notați azi**, grupată pe culegător (`ListRow`): nume, total kg (cal 1 / cal 2), lei, numărul de cântăriri dacă sunt mai multe. Fără segmente Săptămână/Sezon, fără listă „fără kg azi”.
- `EmptyState` când nu e nimic azi, cu același buton.
- **Butonul mare „Adaugă kg”** (56 px, `h-touch-lg`), fix jos, deasupra barei de jos. **Înlocuiește FAB-ul (+) pe această pagină** (nu înregistra acțiunea în `useAddAction`; FAB-ul nu apare pe Recoltări). Dacă asta cere o modificare în `AddActionContext` / FAB, o descrii în plan.
- **Tema coral dispare complet** din modul (`--brand-coral-*`, gradientul cu hex, `rounded-[...]`, `shadow-[...]`). Doar tokeni canonici și componente de kit.

### Adăugarea — `StepForm` pe tot ecranul
**Pasul 1 — culegătorul**
- Plăci mari pe 2 coloane (`TileGroup` / `Tile`): inițială, prenume, nume. Cei notați deja azi au insigna „✓ azi N kg”; atingerea lor adaugă **încă o cântărire** (înregistrare nouă).
- Ultima placă: „Culegător nou” → `BottomSheet` cu nume + tarif (lei/kg), salvat prin `createCulegator` existent; după salvare e selectat automat și treci la pasul 2.
- Fără căutare. Doar culegătorii activi (cum filtrează acum codul).

**Pasul 2 — kilograme**
- Pastile schimbabile: **data** (implicit azi; în pas se alege cu `CalendarPanel`, cum cere `CLAUDE.md`) și **parcela** (implicit ultima folosită, listă în `BottomSheet`); cultura se deduce din parcelă (logica actuală din `AddRecoltareDialog`, nu o rescrii).
- `KgField` + `NumericKeypad` în zona `dock`. **Câmpul de kg pornește GOL**, fără nicio valoare propusă (nici din ultima recoltare). Zecimale cu virgulă (27,35).
- Calitatea 2 ascunsă până la „Adaugă calitatea 2”.
- Plata estimată (kg × tarif culegător) se recalculează pe loc (`SummaryRow` sau text sub câmpuri).
- **Butoane — problema de la 800 px:** cu tastatura în `dock`, două butoane mari jos nu încap. Soluția propusă: **un singur buton principal „Salvează”** în footer; după salvare, `SuccessScreen` cu două acțiuni: „Următorul culegător” (înapoi la pasul 1, formular nou, cheie nouă) și „Gata” (înapoi la listă). Dacă ai o variantă mai bună care păstrează toate tastele + butonul vizibile fără derulare la 390×800, o propui în plan.
- Observațiile: câmp opțional, discret (ex. „Adaugă o notă” → `BigTextarea`), nu în fața tastaturii.

**Verificare** — decizi în plan dacă păstrezi pasul de verificare din `StepForm` sau salvezi direct din pasul 2 (seara, multe cântăriri la rând: cât mai puține atingeri). Recomandare: salvare directă din pasul 2, cu rezumatul (culegător, parcelă, dată, kg, lei) vizibil deasupra câmpului.

### Idempotență
- `create_recoltare_with_stock` **nu primește** acum `client_sync_id`. Verifică (doar citire: `src/types/supabase.ts`, migrările din `supabase/migrations/`, interogări SELECT pe schemă) dacă `recoltari` are coloana și un index unic.
- În Etapa A: butonul „Salvează” blocat cât rulează cererea (`loading`), o singură trimitere per cheie `StepForm`.
- Dacă e nevoie de o migrare (parametru `p_client_sync_id` + index unic), **o scrii ca fișier separat în `supabase/migrations/`, aditivă, și te oprești** — Andrei o aprobă și o rulează. Nu o aplici tu.

### Analytics
Păstrezi exact evenimentele de acum (`open_create_form`, `create_success`, `create_failed`, `form_abandoned`, `create_recoltare`, `recoltare_add`, `recoltare_delete`, `delete_item`, `view_module`), prin ciclul de viață din `StepForm`. Fără `await` pe ele.

### Precompletarea din chat AI (`hasAiOpenForm` / `parseAiRecoltarePrefill`)
Chatul AI e pus deoparte, dar legătura prin URL rămâne funcțională: deschide `StepForm` cu parcela, data și observațiile primite. Kg venite din AI (dictate de utilizator) pot precompleta câmpul — spune în plan cum le marchezi vizibil.

### Etapa B — restul
- Atingerea unui rând din listă → `BottomSheet` cu cântăririle acelui culegător azi; fiecare cântărire: vizualizare, **Editează** (formular pe kit, aceleași câmpuri ca la adăugare, valoarea existentă afișată — aici nu e „propunere”, e valoarea salvată), **Șterge** (confirmare + anularea existentă cu temporizator).
- **Zile anterioare:** prima pagină rămâne „azi”, dar editarea unei greșeli de ieri trebuie să fie posibilă. Propune în plan un acces discret (ex. pastila de dată din antet → `CalendarSheet` → aceeași pagină pentru ziua aleasă, cu „Înapoi la azi”). Căutarea și filtrele avansate: propui dacă le păstrezi acolo sau le elimini (Andrei decide la plan).
- Ștergi componentele vechi rămase fără utilizare (`AddRecoltareDialog`, `EditRecoltareDialog`, `ViewRecoltareDialog`, `RecoltareFormSummary`, dacă nu mai sunt importate nicăieri) și codul mort din `RecoltariPageClient`. Verifici cu `grep` înainte de ștergere.
- Adaugi folderele Recoltări în `KIT_RULE_DIRS` (`scripts/kit-rules.mjs`), ca `npm run check:kit` să le acopere.

### Desktop
Nu facem design de desktop acum. Cerința: pe desktop pagina **funcționează** (aceeași structură, coloană centrată cu lățime maximă rezonabilă, `StepForm` / `BottomSheet` utilizabile cu mouse și tastatură fizică — cifrele de la tastatura fizică scriu în `KgField`, dacă kitul nu face deja asta, propui în plan). Fără tabele separate pentru desktop.

## Verificare

- `npm run lint`, `npm run typecheck`, `npm run check:kit`, `npm run build`, testele kitului și `src/lib/recoltari/__tests__` + `src/__tests__/recoltari-aggregate-by-culegator.test.ts`.
- Vizual local (Chromium), zi și noapte, la 390×800 și 412×915: toate țintele ≥ 48 px, tastatura + butonul principal vizibile fără derulare la pasul 2, nimic nu iese din cadru.
- **Salvarea nu se testează pe datele reale.** Preview-urile și mediul local folosesc baza de producție. Fluxul de salvare / editare / ștergere se verifică **doar într-un cont demo creat prin `/start`** (tenant de test, șters automat după 24 h de cron), exclusiv prin interfață. În planul tău spui exact cum faci asta. Fără SQL de scriere, niciodată.
- Fluxul fără salvare (deschidere, pași, tastatură, înapoi) se poate verifica și în contul lui Andrei, fără a apăsa „Salvează”.

## Reguli de lucru

- Doar componente de kit și tokeni canonici; regulile kitului din `CLAUDE.md` (fără hex, fără `dark:`, fără `--agri-*`, fără `text-[` sub 13 px, fără `z-[`, ținte ≥ 48 px, acțiunea principală 56 px, câmpuri la 17 px) se aplică și în modul.
- Dacă îți lipsește ceva din kit, **nu îl inventezi în modul**: îl adaugi în kit (cu test și pe `/admin/kit`) și îl menționezi în raport.
- Nu schimbi RPC-urile, `scheduleAutoManoperaSync`, logica de stoc sau `src/app/api/paste-to-recoltari/`.
- Nu atingi alte module (Comenzi, Livrări, Culegători etc.), cu excepția strict necesară pentru FAB (descrisă în plan).
- `public/sw.js` nu intră în niciun commit.
- Nu faci merge în `main`, nu deschizi PR. Push doar pe `redesign/recoltari`.

NEVER delete, truncate, or modify any user data in the database. Do not run DELETE, UPDATE, or TRUNCATE on production data tables. Do not reset or seed over existing data.
