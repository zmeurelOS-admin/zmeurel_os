# Raport — promptul 34 (final): corecturile de pe ferma reală + desktopul pe interfața nouă

Branch: `redesign/34-final`, pornit din `origin/main` la `a5b60e1`. **Fără merge.** `public/sw.js` nu e în niciun commit.
**Nicio migrare.** Scrierile de test s-au făcut doar în demo-uri noi create din `/start`. Ferma reală nu am atins-o.

## Pașii tăi (Andrei)

1. Nimic de aplicat în Supabase și nicio variabilă nouă pe Vercel.
2. Pe telefon, după deploy (aplicația instalată, Android):
   - pe fișa Maravilla 1, deschide și închide 2–3 foi, apoi „înapoi” cu swipe: trebuie să ajungi la lista de parcele din
     prima. Cu o foaie deschisă, „înapoi” o închide doar pe ea;
   - banda „Pune Caietul pe ecranul telefonului” apare în Acasă doar dacă aplicația **nu** e instalată (deci în browser,
     de la a doua zi). Pe telefonul pe care o ai instalată nu o vei vedea.
3. Pentru butoanele „Tai tot / Păstrez” la ferma ta trebuie ca modul lăstarilor să fie „An 1 + an 2”. Fie e ales în
   „Cum lucrezi lăstarii” (cere migrarea `20261125110000` din 33), fie parcela are deja un stadiu pe floricane. N-am putut
   verifica dacă migrarea e aplicată (conectorul Supabase nu are drept de citire pe proiect).

## 1. Ce am schimbat, pe secțiuni

### §5 „Înapoi” fără istoric (commit `6febdd8`)
**Ce era (reprodus întâi):**
- fiecare foaie (`BottomSheet`, `StepForm`, orice `ui/dialog`) făcea `history.pushState` la deschidere;
- la închiderea din X, Esc sau după salvare scotea doar marcajul, iar intrarea rămânea;
- în plus, cu un `onOpenChange` nou la fiecare desenare, efectul pierdea ascultătorul de „înapoi”.

Testul `e2e/smoke/inapoi-foi.spec.ts`, rulat **pe codul vechi** (build din `origin/main`, demo nou, fișa Maravilla):

| Pas | `history.length` (așteptat 5) |
|---|---|
| meniul „⋯” deschis | 6 |
| meniul închis din X | 6 |
| meniul închis cu Esc (a doua oară) | 7 |
| „⋯” → „Editează” → X | 9 |
| Stadiul închis cu Esc | 10 |
| Stadiul salvat → „Gata” | 11 |
| un singur `goBack()` | rămâne pe fișă (așteptat: lista de parcele) |

Detaliul e în `docs/redesign/screenshots/34/s5-rosu.txt`.

**Ce am făcut:**
- `src/lib/ui/useInchideLaInapoi.ts`: unde browserul are `CloseWatcher` (Chrome / Edge, Android și desktop, aplicația
  instalată), fiecare fereastră deschisă își face un watcher:
  - „înapoi” pe Android și Esc pe desktop închid doar fereastra de deasupra;
  - nu se scrie nimic în istoric;
  - `onClose` se citește dintr-un `ref`, deci o funcție nouă la fiecare desenare nu mai rupe nimic;
  - după o închidere oprită de gardă (ceva nesalvat), watcher-ul se reface.
- Unde nu există (Safari, Firefox): nici atunci nu se scrie nimic în istoric; Esc și X închid normal.
- `ui/dialog` folosește hook-ul. Esc vine pe două căi (Radix și `CloseWatcher`), iar a doua cerere se ignoră.
- `StepForm` păstrează doar garda (`closeGuard`).
- Șterse: `src/lib/ui/dialog-history.ts` și testul lui, `stripDialogHistoryMarker` din `dialog-form-actions`,
  `disableHistory` din `AppDrawer`.

**Teste:**
- `BottomSheet.test.tsx` și `StepForm.test.tsx` rescrise cu un `CloseWatcher` simulat
  (`src/test/helpers/close-watcher.ts`). Acoperă:
  - nimic în istoric la deschidere și închidere;
  - „înapoi” închide foaia;
  - „înapoi” merge și când pagina dă o funcție nouă la fiecare desenare;
  - fără `CloseWatcher`, Esc și X închid normal;
  - garda: „înapoi” oprit, al doilea „înapoi”, închiderea hotărâtă de modul.
- E2E: `inapoi-foi.spec.ts` trece pe codul nou. Verifică `history.length` după fiecare cale, Esc și un singur „înapoi”.

### §1–§2 Lăstari (commit `1926315`)
- `stadiuPentruCiclu` (`src/lib/parcele/lastari.ts`): în „An 1 + an 2”, un rând fără cohortă se citește ca lăstar de an 1,
  **doar** pentru butoanele ciclului. Datele nu se rescriu. `stadiuCurentParcela` întoarce `ciclu`, iar foaia Stadiul îl
  folosește.
- Rândurile vechi fără cohortă se mai citesc „ca până acum” doar cât parcela n-are niciun rând pe un lăstar. După
  „Tai tot”, cardul nu mai arată „După recoltare” de pe rândul vechi.
- §2: lăstarul al cărui ultim rând e „Tăiat” apare pe card cu data, până la următorul lui stadiu. Exemple:
  „Lăstar an 1: Tăiat pe 5 nov.” și „An 2: În repaus · An 1: Tăiat pe 15 nov.”. Planul și notificările îl tratează ca
  înainte (fără stadiu).
- Teste (`lastari.test.ts`):
  - butoanele la un rând vechi singur și la rânduri pe floricane + rând vechi;
  - după „Tai tot”;
  - un rând nou cu cohortă câștigă;
  - modurile cu un singur lăstar;
  - „Tăiat” pe card și dispariția lui după un stadiu nou.

### §6 Fișa parcelei (commit `f133801`)
- **Titlurile** din `ListRow` nu se mai taie, nicăieri: întâi pe cel mult două rânduri, iar la §9 fără limită (vezi
  „Decizii”).
- **Notița „Pune data culesului pe parcele…”** a ieșit de pe fișă: apărea doar când nicio parcelă n-avea dată, deci
  dubla rândul „Pune data culesului”. În Acasă rămâne.
- **Bara „+ Lucrare / + Tratament”**: diagnosticul (Playwright, 360 px cu text mare) a arătat că bara ieșea din ecran în
  dreapta, împinsă de spațiul de 72 px lăsat pentru bula beta. Acum:
  - bara nu mai lasă spațiul acela;
  - butoanele au padding mai mic și trec unul sub altul dacă nu încap;
  - `AppShell` măsoară bara fixă și lasă jos exact înălțimea ei + distanța + bara de jos cu zona sigură.
- Teste: `ListRow.test.tsx`, `AppShell.test.tsx`. Captura: `screenshots/34/s6-fisa-360-text-mare-dupa.png`.

### §7 Lucrări → „Altele” (commit `a173dd4`)
- La „Altele”, pasul 2 are câmpul obligatoriu „Ce ai făcut?” (80 de caractere).
  - Se salvează în `tip_activitate` ca `Altele: <text>`, fără migrare.
  - Titlul în jurnal (Lucrări, fișa parcelei, Acasă) e textul.
- Prefixul se recunoaște înaintea euristicilor: „Curățat…” nu devine tăiere, iar „tratament…” nu ajunge în Tratamente.
- **„Folosite des la Altele”** în pasul 1:
  - cel mult 5 texte, din lucrările fermei (textul de după prefix);
  - fără diferențe de majuscule și diacritice, un lot pe mai multe parcele contează o dată;
  - o alegere completează pasul 2.
- Lucrările „Altele” vechi se afișează ca înainte.
- Teste: `src/lib/lucrari/__tests__/altele.test.ts` (prefixul, tratamentele, titlul, salvarea, jurnalul, alegerile
  rapide) și `LucrareStepForm.altele.test.tsx` (câmpul obligatoriu, alegerea rapidă).

### §8 Tratament „La sol” (commit `87d503c`)
- **Pe parcele (total) sau la ha**, în **kg, tone sau litri**, cu conversia sub câmp. Exemple:
  „3 t/ha × 0,25 ha = 0,75 t” și „750 kg pe 0,25 ha = 3.000 kg/ha”.
- **În bază** rămân kg / l (`cantitate_totala` + `unitate_cantitate`). La ha, doza se scrie în `doza_l_per_ha`, în kg/ha.
- Unitatea aleasă stă în `cantitate_text`, de exemplu „0,75 t · 3 t/ha”. **Registrul, fișa parcelei și jurnalul**
  afișează cantitatea în ea (`afisareSol`):
  - registrul: doza „3 t/ha”, cantitatea „0,75 t”;
  - fișa: „Gunoi de grajd 0,75 t (3 t/ha) · fără pauză”;
  - jurnalul: „Gunoi de grajd 3 t (3 t/ha)” pe lot.
- **„La ha” fără suprafață pe parcele**: nu se poate salva („scrie cantitatea pe parcele”).
- **Produsul scris de mână**, doar la „La sol”:
  - alegerile „Gunoi de grajd” / „Compost” sau un nume oarecare;
  - fără catalog și fără magazie, pauza 0;
  - gunoiul și compostul pornesc pe tone.
- **„Repetă”** citește înapoi tonele și modul la ha.
- **Reparat în registru**: la stropirea cu pulbere „la ha” scria „l/ha”; acum scrie „kg/ha”.
- Teste:
  - `src/lib/tratamente/__tests__/sol.test.ts`: conversii, texte, salvare, „Repetă”, jurnal, fișă, registru;
  - `DetaliiSol.test.tsx`: conversia afișată și schimbarea unității / modului.

### §9 Textul care iese din chenar (commit `540caaa`, plus reparațiile din §3 și §10)
- „Ce fel de produs”: plăcile pe 2 coloane; titlul plăcii se rupe pe rând dacă nu încape.
- `KgField` (`md`):
  - cifrele se micșorează după lungime: până la 6 caractere 22 px, 7–8 caractere 19 px, peste 8 caractere 17 px;
  - câmpul trece pe două rânduri (eticheta, apoi valoarea).
- **„Sigur?”** în „Am cumpărat”, peste **2.000 kg / 500 l / 500 buc** (`src/lib/magazie/praguri.ts`): „Da, salvez” /
  „Corectez”.
- **Kitul fără „…”**: `ListRow` (titlu și detaliu), `Segments` (fila crește pe înălțime), `StatusPill` (trece pe rândul
  următor), `SummaryRow`, `StatTile`, `ActionCard`, insigna din `Tile`.
- **Testul** `e2e/smoke/text-in-chenar.spec.ts` + `text-in-chenar.ts`.
  - Ecranele: Acasă, Livrări, Recoltări, Comenzi, Mai mult, Tratamente (4 taburi), Magazia, Parcele + fișa, Lucrări,
    Echipa, Setări.
  - Formularele (deschise și închise, fără salvare): Recoltare, Comandă, Lucrare (Altele), Tratament (metoda),
    Am cumpărat → Produs nou, Stadiul.
  - Lățimile: 360 px normal, 360 px cu „Mărimea: Mare” și 1440 px.
  - Pică la text tăiat (`ellipsis` / `overflow` ascuns cu `scrollWidth > clientWidth`, `line-clamp` cu
    `scrollHeight > clientHeight`), la text ieșit din chenar (pe verticală doar peste un sfert din literă, din cauza
    diacriticelor din titlurile mari) și la derulare orizontală.
  - **Excepții: niciuna** (`EXCEPTII_TEXT` e gol).
- Ce a găsit și am reparat, pe rânduri de rulare:
  - **Prima rulare (360 px):**
    - „Mai târziu” tăiat în filele Comenzi;
    - „Primocane · lăstar an 1” tăiat în foaia Stadiul;
    - detalii pe 3+ rânduri tăiate (Plan, Analize, Repetă);
    - „Am cumpărat” ieșea din buton (locul bulei beta, §3).
  - **Cu text mare:**
    - „Culesul începe pe ~22 iunie” și alte titluri pe 3 rânduri, tăiate de limita de 2;
    - pastila cu parcelele din cardul de tratament ieșea din card.
  - **Rularea finală: 3 / 3** (360, 360 cu text mare, 1440).
- Teste: `praguri.test.ts`, `KgField.test.tsx` (mărimea cifrelor, rândul dublu).

### §3 Fără bula „Ești în beta” (commit `040c5a0`)
- `beta-widget.tsx` șters și scos din `DashboardShellSlots`.
- În Mai mult, rândul „Ajutor” a devenit „Scrie-mi o problemă sau o sugestie” (WhatsApp, `SUPPORT_WHATSAPP_URL`).
  Superadminul nu îl vede.
- Cele 18 bare fixate jos nu mai lasă loc pentru bulă. Butoanele din Magazia se rup pe rând dacă nu încap.
- Test: `MaiMultSugestii.test.tsx` (proprietar și operator îl văd, superadminul nu).

### §4 Invitația de instalare (commit `67d368f`)
- `src/lib/pwa/instalare.ts`: logica comună cu magazinul.
  - `esteInstalata`, `esteIphone`, prinderea `beforeinstallprompt`, `cereInstalarea`;
  - regula benzii, `aratBanda`;
  - starea pe dispozitiv, în `zmeurel_instalare`.
- Magazinul folosește doar `esteInstalata` (aceeași regulă). Cheile, textele și aspectul lui nu s-au schimbat.
  `public/sw.js` neatins.
- **Banda** (`BandaInstalare`), doar în Acasă și doar pe telefon, deasupra barei de jos:
  - cont real (proprietar sau operator), nu demo;
  - de la a doua zi de folosire sau după prima salvare (`useStepForm.markSuccess` semnalează);
  - X = ascunsă 30 de zile;
  - nu apare dacă aplicația e instalată.
- **„Instalează”**:
  - pe Android cu promptul prins: promptul sistemului;
  - pe iPhone: foaia cu „Distribuie → Adaugă pe ecranul principal”;
  - pe Android fără prompt: meniul browserului.
- Butonul plutitor urcă deasupra benzii (`--banda-instalare-h`).
- **În Mai mult**, „Instalează aplicația” cât aplicația nu e instalată (și în demo).
- `src/components/pwa` și `src/lib/pwa` sunt în `check:kit`. `PWAInstallPrompt*` (ale magazinului) stau în
  `KIT_RULE_PENDING_FILES`.
- Teste: `instalare.test.ts` (demo, prima zi, a doua zi, salvarea, 10 / 31 de zile, instalată, iPhone) și
  `BandaInstalare.test.tsx` (Android cu prompt, iPhone cu foaia, demo, X).

### §10 Desktopul pe interfața nouă (commit-uri `a2763a2`, `d7e1f41`)
- **O singură sursă de navigație**: `src/lib/navigatie/meniu.ts`.
  - Conține principalele, grupurile „Ferma” / „Bani și oameni”, Admin, rândurile de la final, regulile pentru operator
    și superadmin, plus `hrefActiv`.
  - O folosesc bara de jos, Mai mult și bara laterală. Iconițele: `src/components/app/navigatie-iconite.tsx`.
- **Bara laterală** (rescrisă pe kit):
  - sus logo-ul „Caietul Fermei” și clopoțelul (fereastra se deschide spre dreapta);
  - apoi Acasă · Livrări · Recoltări · Comenzi și grupurile din Mai mult, cu aceleași nume;
  - jos Planul tău, Setări, „Scrie-mi…” și contul (meniu în sus);
  - fără grupurile vechi și fără emoji;
  - restrângerea la 64 px a rămas; zona asociației rămâne ca înainte.
- **Antetul** (`PageHeader` / `CompactPageHeader`):
  - același pe telefon și pe desktop, pe tokeni, pe lățimea coloanei;
  - fără fundalul verde, fără chipurile „Comenzi · Livrări · Recoltări · Clienți” și fără „Editează”;
  - clopoțelul din antet rămâne doar pe telefon.
- **`/dashboard` = Acasă** de pe telefon (`AcasaMobile` → `Acasa`), o coloană de 720 px.
  - Pagina a scăzut de la 1.810 linii la ~260.
  - Încarcă doar ce arată Acasă. Pleacă cererile pentru cheltuieli, produse, solarii, comenzile magazinului și
    layout-ul.
- **Coloana modulelor**: tokenul `--container-modul: 45rem` → `max-w-modul`. Îl folosesc `ScreenHeader`, `ScreenBody`,
  Acasă și modulele care aveau `max-w-xl` / `max-w-2xl`. Documentat în `tokens.md`.
- **`BottomSheet` pe desktop**: dialog centrat pe ecran, fără mâner.
- **„Magazinul tău online”** în Setări › Ferma, doar pentru proprietar: linkul spre `/magazin/<fermă>` sau vitrina
  asociației.
- **Șterse:**
  - `src/components/dashboard/`, tot folderul: `DashboardCard`, `DashboardEditableGrid`, `DashboardStaticWidgetGrid`,
    `DashboardV2Sections`, `DashboardWidgets`, `MeteoDashboardCard`, `Sparkline`, `TaskList`;
  - `src/lib/dashboard/`: `layout`, `grid-config`, `grid-compact`, `attention`, `context`, `recommendations`,
    `microclimate`, cu testele lor;
  - `src/lib/supabase/queries/profile-dashboard.ts`;
  - `engine.ts`, tăiat la starea parcelelor (`IntrareStariParcele`);
  - CSS-ul `dashboard-*` / `react-grid-layout` din `globals.css` (140 de linii);
  - **`react-grid-layout` și `react-resizable`**, cu `npm uninstall`; `package-lock.json` actualizat, build verificat.
- Teste:
  - `src/lib/navigatie/__tests__/meniu.test.ts`: proprietar, telefon vs desktop, operator, superadmin, intrarea activă,
    Investiții;
  - `MagazinulTau.test.tsx`;
  - e2e `e2e/smoke/desktop.spec.ts`, la 1440 px (**4 / 4**):
    - Acasă nouă, fără cardurile vechi, „Dashboard” și „Editează”;
    - fiecare legătură din bara laterală duce la ruta ei și se aprinde;
    - clopoțelul și contul se deschid;
    - foaia e centrată.

## 2. Migrările

Niciuna. Toate secțiunile merg pe coloanele existente:
- §7: `tip_activitate` n-are listă de valori.
- §8: tonele se scriu în kg, iar constrângerea `unitate_cantitate` n-o ating.
- §4: starea instalării stă în `localStorage`.

## 3. Decizii luate de mine

- **Titlurile `ListRow`, fără limită de rânduri.** Ai aprobat „cel mult două rânduri”. Cu „Mărimea: Mare”, titluri ca
  „Culesul începe pe ~22 iunie” (cu „Schimbă” în dreapta) trec de două rânduri și se tăiau, iar testul de la §9 cere
  „fără tăiere”. Titlul se vede acum întreg, pe câte rânduri are nevoie.
- **Detaliul `ListRow`, la fel**: înainte era limitat la două rânduri; acum se vede întreg.
- **`StatusPill` trece pe rândul următor** când nu încape (înainte, implicit pe un rând, ieșea din card).
- **`check:critical` pică pe `origin/main`** la `check:server-supabase-boundaries`:
  - căile `src/lib/schema-features.ts` → `src/lib/supabase/client.ts`, ajunse din pagini de server (Clienți, Material
    săditor, raportul public, cronuri);
  - nu vine din promptul 34 (verificat pe un worktree curat din `origin/main`);
  - la fiecare push am rulat restul pașilor din `check:critical`: `check:sensitive-hardcoding`, `check:brand`, `lint`,
    `typecheck`, `test:critical`, plus `check:kit` și `build`;
  - reparația înseamnă să schimbi cum citesc paginile de server coloanele noi, deci n-am atins-o aici (vezi „Rămas”).
- **„Investiții” în bara laterală** duce la `/investitii`, care redirecționează pe Cheltuieli, fila „Investiții”. Rândul
  activ e „Investiții” (`hrefActiv` citește `fila=investitii`).
- **Operatorul pe desktop** are în bara laterală modulele lui sus, grupurile fără ele, „Mai mult” (notificările și
  ieșirea din cont, ca pe telefon) și „Scrie-mi…”.
- **`DashboardSidebarSkeleton`** a rămas, simplificat pe tokeni; e locul barei cât se încarcă.
- **`DashboardContentShell`** a rămas: îl folosesc paginile Admin.

## 4. Ce n-am putut testa

- **Gestul „înapoi” real pe Android**: Playwright simulează cu Esc (tot o cerere de închidere în Chrome) și cu
  `goBack()`. Confirmarea finală e pe telefonul tău.
- **Promptul real de instalare** (`beforeinstallprompt`) și iPhone-ul: doar în testele de componentă.
- **Ferma ta**: dacă modul lăstarilor e „An 1 + an 2” și dacă migrarea `20261125110000` e aplicată (fără drept de
  citire prin conector).
- **„La sol” salvat în bază**: logica e testată unitar, iar formularul l-am deschis doar la metodă (testul §9). N-am
  salvat un tratament „La sol” în demo.
- **„Sigur?”** în browser: testat unitar (pragurile). În browser am verificat doar că formularul se deschide fără text
  ieșit din chenar.
- **Ecranele nerefăcute pe desktop** (Asociația, Admin, Material săditor): primesc antetul nou și bara laterală nouă.
  Le-am deschis doar prin testul de desktop (Material săditor), nu pe toate.

## 5. Verificările (pe codul final)

Rulate înainte de fiecare push (scriptul porții, `check:critical` fără pasul care pică și pe `main`):

| Comanda | Rezultat |
|---|---|
| `npm run check:sensitive-hardcoding` | trece |
| `npm run check:brand` | trece |
| `npm run lint` | trece: 0 erori, 4 avertizări vechi (neatinse) |
| `npm run typecheck` | trece |
| `npm run check:kit` | trece: 357 de fișiere, fără abateri |
| `npm run test:critical:unit` | trece: 158 de fișiere, **1.307 / 1.307** |
| `npm run build` | trece |
| `npm run check:server-supabase-boundaries` | **pică, la fel ca pe `origin/main`** (vezi „Decizii”) |
| `npm run test:e2e:smoke` (local, `next start`, demo-uri noi) | 26 / 27 la prima rulare: pasul 16 căuta „Magazia” și o găsea întâi în bara laterală nouă (contextul smoke e pe desktop). Locatorul e restrâns la `main`; `pasi-principali` rulat din nou: **19 / 19** |
| `e2e/smoke/inapoi-foi.spec.ts` (nou) | pe codul vechi: **pică** (tabelul de la §5); pe codul nou: **1 / 1** |
| `e2e/smoke/text-in-chenar.spec.ts` (nou) | **3 / 3**: 360 px, 360 px cu text mare, 1440 px, fără excepții |
| `e2e/smoke/desktop.spec.ts` (nou) | **4 / 4** la 1440 px |

## 6. Capturi

În `docs/redesign/screenshots/34/`:
- **360 px**: `360-acasa.png`, `360-mai-mult.png`, `360-fisa-parcelei.png`, `360-lucrare-altele.png`,
  `360-produs-nou.png`, `s6-fisa-360-text-mare-dupa.png`;
- **1440 px**: `1440-acasa.png`, `1440-comenzi.png`, `1440-tratamente.png`, `1440-parcele.png`,
  `1440-foaie-centrata.png`.

## 7. Commit-urile

```
bf1a4e8 docs(redesign): promptul 34 — final (corecturile de pe ferma reală + desktopul pe interfața nouă) și planul aprobat
6febdd8 fix(foi): „înapoi” fără istoric — foile și formularele pe pași nu mai scriu în istoric; CloseWatcher închide fereastra de deasupra (Android, Esc), ascultătorul nu se mai pierde la o funcție nouă
1926315 fix(parcele): „Tai tot / Păstrez” și la rândurile vechi fără lăstar (în An 1 + an 2 se citesc ca an 1, doar pentru butoane); „Tăiat pe 12 oct.” pe cardul stadiului până la următorul stadiu al lăstarului
f133801 fix(parcele): fișa parcelei — titlurile rândurilor pe cel mult două rânduri (ListRow, peste tot), fără notița dublată „Pune data culesului pe parcele…”, bara „+ Lucrare / + Tratament” încape (fără locul bulei beta, butoanele trec unul sub altul la nevoie), iar AppShell lasă jos exact înălțimea barei fixe
a173dd4 feat(lucrari): „Altele” cu „Ce ai făcut?” obligatoriu — textul devine titlul lucrării în jurnal (tip_activitate „Altele: …”, fără migrare); „Folosite des la Altele” în pasul 1, din lucrările fermei
87d503c feat(tratamente): „La sol” pe parcele sau la ha, în kg, tone sau litri, cu conversia afișată; produsul se poate scrie de mână (gunoi de grajd), fără catalog și magazie
540caaa fix(kit): textul nu mai iese din chenar — „Ce fel de produs” pe 2 coloane, cantitatea lungă din „Am cumpărat” se micșorează, „Sigur?” peste 2.000 kg / 500 l / 500 buc; fără „…” în ListRow, Segments, StatusPill, SummaryRow, StatTile, ActionCard
040c5a0 feat(shell): fără bula „Ești în beta” — în Mai mult, „Scrie-mi o problemă sau o sugestie” (WhatsApp, ascuns pentru superadmin); butoanele fixate jos iau toată lățimea (fără locul bulei)
67d368f feat(pwa): „Pune Caietul pe ecranul telefonului · Instalează” în Acasă, pe telefon — cont real (proprietar sau operator), de la a doua zi sau după prima salvare, închisă 30 de zile; promptul sistemului pe Android, pașii din Safari pe iPhone; „Instalează aplicația” în Mai mult
a2763a2 feat(desktop): desktopul pe interfața nouă — bara laterală cu aceeași navigație ca telefonul (o singură sursă, src/lib/navigatie/meniu.ts), clopoțelul și contul în ea; /dashboard = Acasă de pe telefon, pe o coloană de 720 px; antetul fără chipuri și „Editează”; BottomSheet centrat pe desktop
d7e1f41 feat(setari): „Magazinul tău online” în Setări › Ferma, doar pentru proprietar — linkul spre magazinul public al fermei (sau vitrina asociației), care era doar pe cardul vechi de desktop
(plus commit-ul acestui raport)
```

## 8. Rămas (după acest prompt)

- `check:server-supabase-boundaries` (pică și pe `main`): paginile de server Clienți / Material săditor, raportul
  public și cronurile ajung la clientul de browser prin `schema-features`. Trebuie o variantă de server pentru
  „ce coloane există”.
