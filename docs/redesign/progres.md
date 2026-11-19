# Redesign UI — progres

Ultima actualizare: 19 noiembrie 2026, după kitul de componente (prompt 04).

| Fază | Stare |
|---|---|
| 0 — Audit UI | **gata**: `docs/redesign/audit.md` |
| 0b — Audit analytics | **gata**: Anexa G, secțiunile 4 și 6 din `audit.md` |
| — Ștergerea fișierelor nefolosite (Anexa E) | decisă; pas separat înainte de Faza 1 |
| 1a — Fundația: modul noapte, straturi, tokeni | **gata** pe branch `redesign/fundatie` (nemergeuit): `docs/redesign/tokens.md` |
| 1b — Componentele kitului + `/admin/kit` | **gata** pe branch `redesign/kit` (nemergeuit): `src/components/kit/`, `/admin/kit`, regulile din `CLAUDE.md` |
| 2 — Mockupuri pe module | neîncepută |
| 3 — Implementare modul cu modul | neîncepută |

## Ce s-a făcut în Faza 0

- Inventarul celor 22 de rute din `src/app/(dashboard)` (inclusiv admin), cu fișiere, formulare și felul în care se desparte mobilul de desktop.
- Problemele care țin de toată aplicația, numărate cu `git grep` pe HEAD `1e3ca48` (comenzile sunt în Anexa F din raport).
- Componentele duplicate și lista de fișiere nereferite.
- Propunerea de kit: valori, 16 componente de extras din Material săditor, strategia de migrare a tokenilor.
- Ordinea propusă a modulelor și riscurile.

Cod neatins: singurele fișiere create sunt `docs/redesign/audit.md` și acest fișier. Nu s-a scris nimic în baza de date.

## Ce s-a făcut în Faza 0b

- Au rulat pe producție (18.11.2026) două `SELECT` pe `analytics_events`: `view_module` (Anexa G, A) și `page_view` pe rută normalizată (B). În repo sunt doar agregate anonimizate.
- Volum mic: 404 `page_view` în 90 de zile, 5 tenanți reali, unul cu 360 de vizualizări. Tratate ca tendință.
- Top module (tenanți reali): Comenzi 137, Livrări 93, Dashboard 68 (singurul deschis de toți), Recoltări 54; restul sub 5, multe la zero.
- Ordinea revizuită: Recoltări rămâne pilot, Comenzi + Livrări imediat după, Dashboard urcă pe 3; Asociația iese din ordine („mai târziu”).
- Deciziile din 18.11.2026 trecute în secțiunea 6 din audit.

Cod neatins: s-au modificat doar `docs/redesign/audit.md` și acest fișier. Nimic scris în baza de date.

## Ce a rămas

- **Analytics.** Rezolvat. Zona publică nu e măsurată de `page_view` (trackerul e doar în dashboard).
- **Atribuirea țintelor mici pe ecrane.** Numărătoarea automată nu separă butoanele de iconițe; lista exactă pe ecran se face la mockupuri.
- **Teste.** Nu am rulat `lint`, `typecheck` și nici testele e2e. Unele e2e caută text fără diacritice și s-ar putea să pice deja.
- **Fișierele nereferite** (36) sunt candidați stabiliți după nume; înainte de ștergere trebuie un build de control.
- **Zona publică** (magazin, comandă, livrator, landing) apare doar în cifrele pe zone, nu are inventar detaliat.

## Decizii (18.11.2026)

1. Tema coral din Comenzi / Livrări / Recoltări dispare; un singur set de tokeni.
2. Asociația (`/asociatie/*`) nu intră acum în revamp; „mai târziu”.
3. Chat-ul AI rămâne în cod, neatins și fără buton; în afara revamp-ului.
4. Desktopul nu intră acum în revamp; modulele refăcute nu au voie să strice desktopul actual.
5. Analytics: rezolvat (Faza 0b).
6. Fișierele nefolosite (Anexa E) se șterg într-un pas separat, înainte de Faza 1.

## De verificat pe telefon

Totul de mai jos e dedus din cod; nimic nu a fost văzut pe ecran.

| # | Unde | Ce verificați | De ce |
|---|---|---|---|
| 1 | `/asociatie/livrari`, cont de asociație | Se vede bara „Livrate x / y” de jos sau e acoperită de bara de navigare? | E `fixed bottom-0 z-20`, sub bara de jos (z 50). |
| 2 | `/comenzi`, apăsați „+” | Fundalul întunecat acoperă și bara de jos? Butonul de închidere stă peste FAB sau sub el? | Speed dial-ul e în stratul `z-10` al paginii. |
| 3 | Telefon pe temă luminoasă, aplicația pe „întunecat” (Setări) → `/parcele` | Apar panouri albe cu text deschis? | `bg-white` + `dark:` care ascultă de telefon. |
| 4 | Telefon pe temă întunecată, aplicația pe „luminos” → `/parcele`, `/login`, `/start` | Apar zone închise la culoare pe o pagină luminoasă? | Același motiv, invers. |
| 5 | Aplicația pe „întunecat” → `/comenzi`, `/livrari`, `/recoltari` | Rămân luminoase? Dialogul de confirmare a livrării are alte culori decât pagina? | Tema coral nu are variantă de noapte și nu ajunge în ferestrele din portal. |
| 6 | „Mai mult” din bara de jos | Apare ca fereastră la mijloc sau ca foaie de jos? | `AppDrawer` e de fapt un dialog centrat. |
| 7 | `/cheltuieli` → adăugare → categoria „Altele” și data | Se deschid selectorul și calendarul? | Sunt controale ascunse, deschise prin cod. |
| 8 | iPhone, orice formular vechi → atingeți un câmp de căutare dintr-un selector | Se mărește pagina la focus? | Câmpuri cu text sub 16 px. |
| 9 | `/vanzari-butasi` → foaia de sortare, apoi „înapoi” pe Android | Se închide foaia sau se schimbă pagina? | Foaia nu e legată de mecanismul de istoric al dialogurilor. |
| 10 | Orice pagină | Există vreun buton care deschide chat-ul AI? | Nu am găsit niciun apel care să-l deschidă. |
| 11 | `/clienti-magazin` și `/analytics-magazin` pe telefon (adresă scrisă de mână) | Au antet? Tabelul se derulează lateral? | Nu folosesc `AppShell`; nu sunt în meniul de mobil. |
| 12 | `/recoltari` → adăugare, pe un telefon mic | Butonul „Salvează” rămâne vizibil cu tastatura deschisă? | Dialog centrat cu înălțime maximă 88 % din ecran. |

---

# Curățenie cod mort (prompt 02, 18.11.2026)

Branch `redesign/cleanup` (din `redesign/audit`). Doar ștergeri de fișiere și docs; nicio schimbare de logică. Nimic în baza de date.

## Ce s-a șters

- **Val 1 — Anexa E:** 38 de fișiere, 6.947 de linii (cele 37 din anexă + `parcele/ParcelaForm`, importat doar de `AddParcelaDialog`).
- **Val 2 — orfani:** 6 fișiere, 358 de linii: `app/CompactListCard`, `app/SyncBadge`, `app/status-config`, `clienti/import-types`, `ui/TrendBadge`, `lib/ui/status-badges`.
- **Dependență:** `cmdk` (folosit doar de `ui/command`, șters).
- **Total:** 44 de fișiere, 7.305 linii.
- Metoda: nume ca cuvânt întreg, cale de import și fiecare export, căutate în `src/` (inclusiv teste), `e2e/`, `tests/`, `tests-e2e/`, `scripts/` și configurările din rădăcină. Niciun test nu atingea fișierele șterse, deci nu s-a șters niciun test.
- `ActivitatiAgricolePageClient.tsx` nu mai exista (șters în `dac7c3e`); s-a scos doar mențiunea din `CLAUDE.md`.
- Auditul: 1.3 și 3.3 aliniate la decizia „tema coral dispare”; rând nou în secțiunea 5 despre coada offline.

## Verificare

- `lint`: 3 erori, 14 avertismente — aceleași dinainte, în fișiere neatinse (`analytics-magazin/page.tsx`, `RecoltariPageClient.tsx`, `ui/app-date-picker.tsx`, reguli `react-hooks`). Rulat după fiecare commit de ștergere.
- `typecheck`: trece (după fiecare commit).
- `build`: trece.
- `test:critical:unit`: 135/137 la rularea completă; cele 2 picate (`integrations/google` callback + connect) au fost timeout de 5 s la prima încărcare a modulului. Rerulate separat: 19/19 trec. Mediu, nu ștergere.

## Ce a rămas și de ce

- **De făcut mai târziu (zona Asociație, în afara revamp-ului):** `shop/association/marketplace/` — `MarketAbout`, `MarketCheckoutPanel`, `MarketFilterRail`, `MarketHeader`, `MarketHero`, `MarketHowItWorks`, `MarketProductCard` — și `shop/association/AssociationProductDetailContent`. Au rămas fără importuri după ștergerea lui `AssociationShopClient`. (`MarketSuccessOverlay` și `marketTokens` sunt încă folosite.)
- **Coada offline (`lib/offline`) e inactivă:** enqueue nu e apelat, syncEngine nu pornește; CLAUDE.md o descrie ca activă; e2e/offline.spec.ts probabil pică. De tratat separat, după revamp.
- `lib/design-tokens.ts` rămâne: îl folosesc încă `ComenziPageClient`, `ParcelePageClient`, `ui/Sparkline`.

## De deschis pe telefon (preview)

Fișierele șterse nu erau randate nicăieri, deci nu ar trebui să se schimbe nimic. Verificare rapidă că paginile se încarcă fără eroare:

`/dashboard`, `/parcele` și o parcelă (`/parcele/[id]`), `/activitati-agricole`, `/recoltari`, `/comenzi`, `/livrari`, `/vanzari`, `/vanzari-butasi`, `/clienti` (inclusiv importul de clienți), `/culegatori`, meniul „Mai mult” din bara de jos, `/admin` (superadmin), `/magazin/asociatie`.

---

# Fundația: modul noapte, straturi, tokeni (prompt 03, 18.11.2026)

Branch `redesign/fundatie` (din `main`). Fără redesign: nicio componentă nouă, niciun modul refăcut. Nimic în baza de date. Nemergeuit în `main`.

## Ce s-a făcut

1. **Modul noapte pe clasa aplicației.** `@custom-variant dark` în `globals.css`: cele 160 de clase `dark:` urmează tema aleasă în aplicație, nu tema telefonului. Blocul `@media (prefers-color-scheme: dark)` (fără efect) a fost șters. `ThemeProvider` neschimbat. `tailwind.config.ts` nu e încărcat de nimic; a rămas neatins.
2. **Scara de straturi.** `z-sticky` 20, `z-bar` 40, `z-nav` 50, `z-fab` 60, `z-overlay` 1000, `z-modal` 1010, `z-popover` 1020, `z-toast` 1030. Aplicată în `AppShell`, `CompactPageHeader`, `BottomTabBar`, `UnifiedMobileFab`, `ui/dialog`, `ui/sheet`, `ui/alert-dialog`, `ui/popover`, `ui/select`, `ui/app-select`, `ui/app-date-picker`, `ui/tooltip`, `Toaster`, fundalul comun al ferestrelor și speed dial-ul din Comenzi.
3. **Stratul `z-10` din `AppShell` a fost scos.** Conținutul paginii nu mai are context propriu de stivuire; antetul stă pe `z-bar`.
4. **Setul canonic de tokeni** (suprafețe, text, contur, principal, stări, umbre, raze, atingere), definit o dată în `theme.css` pentru zi și noapte, cu clase Tailwind (`bg-surface`, `text-fg`, `shadow-1`, `rounded-card`, `h-touch` …).
5. **Aliasuri.** Toate numele vechi trimit spre setul canonic; `globals.css` a rămas doar cu variabilele de layout. Tokenii folosiți fără definiție au primit valoare: `--text-muted`, `--surface-muted`, `--border-subtle`, `--shadow-glow`, `--success-surface`.
6. **`docs/redesign/tokens.md`** — referința; `CLAUDE.md` trimite la ea.

## Abateri față de promptul 03 și de plan (toate aprobate sau semnalate)

- `ui/dropdown-menu`, `TopBar` și butonul AI nu există în cod. `AiBottomSheet` a rămas neatins (80 / 81, între FAB și fundal).
- `AppDialog` / `AppDrawer` nu au z-index propriu (moștenesc din `ui/dialog`); `app/StickyActionBar` nu are z-index; `parcele/StickyActionBar` nu e importat de nimeni. Neatinse.
- `--shadow-sm` și `--shadow-md` nu erau nedefinite: le emite Tailwind. Neatinse.
- `src/lib/utils.ts`: `tailwind-merge` a trebuit învățat clasele noi, altfel un `className="z-[60]"` venit din afară nu mai înlocuia valoarea implicită.
- `--success-surface`: planul spunea că nu mai e folosit; avea o utilizare. Alias adăugat după confirmare.
- Asociație (în afara revamp-ului), două atingeri punctuale: bara „Livrate x / y" a primit `bottom-[var(--app-nav-clearance)] md:bottom-0` (două clase în loc de una: fără a doua rămânea un gol sub ea între 768 și 1023 px); foaia de rol din Producători a pierdut `z-[1002]` (ar fi ajuns sub dialoguri).

## Schimbări vizibile ziua (lista exactă)

| # | Token (și aliasuri) | Înainte → După | Locuri | Unde se vede |
|---|---|---|---|---|
| 1 | `--text-secondary`, `--muted-foreground` | #526057 → #3d4a41 | 415 + 2 `var()`, 43 clase `text-muted-foreground` | textul secundar, puțin mai închis, în toată aplicația (mai puțin în paginile Comenzi / Livrări / Recoltări) |
| 2 | `--danger-text`, `--status-danger-text` | #dc2626 → #b91c1c | 42 + 71 | texte și pastile de eroare / „neîncasat" / ștergere: roșu puțin mai închis |
| 3 | `--info-text`, `--status-info-text` | #2563eb → #1d4ed8 | 23 + 14 | pastile și texte albastre de informare |
| 4 | `--value-positive` | #16a34a → #15803d | 6 | cifre verzi (kg, sume pozitive) |
| 5 | `--muted` | #eef3ee → #ededeb | 2 `var()` + 1 clasă `bg-muted` | butonul „anulează" din notificări (toast), zone gri din admin |
| 6 | `--secondary` | #f4f7f4 → #ededeb | 2 clase `bg-secondary` | două fundaluri gri |
| 7 | `--accent-foreground` | #12331f → #102015 | 1 clasă | text pe hover (`ui/button`) |
| 8 | `--agri-shadow` | umbră caldă 0 6px 18px, 7 % → neutră 0 6px 18px, 10 % | 17 `.agri-card` + cardurile shadcn pe mobil (12 fișiere) | umbra cardurilor, foarte puțin mai accentuată |
| 9 | `--text-muted` (era nedefinit) | moștenea culoarea părintelui → #3d4a41 | 16 | Asociație (texte „dezactivat", „fără acces"), ora „acum" din notificări |
| 10 | `--surface-muted` (era nedefinit) | transparent → #ededeb | 2 | Recoltări: fâșia cu linie deasupra din `RecoltariPageClient.tsx:249` primește fundal gri deschis |
| 11 | `--border-subtle` (era nedefinit) | culoarea textului → linie foarte fină | 2 | Asociație → Producători: linia despărțitoare din card (`AssociationProducatoriClient.tsx:373`) |
| 12 | `--shadow-glow` (era nedefinit) | fără umbră → umbră de nivel 2 | 1 | butonul „×" al speed dial-ului din Comenzi |
| 13 | `--success-surface` (era nedefinit) | transparent → #ecfdf3 | 1 | `/analytics-magazin`: pastila activă „7 / 30 / 90 zile" primește fundal verde deschis |

Schimbări de comportament (nu de culoare), zi și noapte:
- **Comenzi → „+"**: fundalul întunecat acoperă acum și bara de jos, iar butonul „×" stă peste FAB.
- **Asociație → Livrări**: bara „Livrate x / y" se vede deasupra barei de jos (înainte era acoperită complet de ea pe telefon).
- **Tooltip-urile** apar peste dialoguri (înainte rămâneau dedesubt).

Fără efect vizibil (0 utilizări): `--bg-secondary`, `--agri-primary-muted`, `--agri-danger`, `--agri-elevated-shadow-hover`.

În paginile Comenzi / Livrări / Recoltări, tema coral își suprascrie singură tokenii de la punctele 1–4, deci acolo se schimbă doar punctele 10 și 12 și ferestrele deschise peste pagină (dialogul de confirmare a livrării etc., care oricum ieșeau din tema coral).

## Schimbări vizibile noaptea (intenționate)

Noaptea erau două palete amestecate (neutru-cărbune din `theme.css` și slate-albastru din `globals.css`). A rămas una, cea neutră. 63 de tokeni și-au schimbat valoarea; tabelul e în `tokens.md`. Ce se vede: cardurile `--agri-surface` (#1a2538 → #12161d), verdele principal (#4ade80 → #5ca882), pastilele active (verde mediu cu text închis), butoanele estompate, notificările și listele derulante (slate → neutru), stările colorate (nuanțe mai stinse), contururile `--agri-border` puțin mai vizibile.

## Verificare

- `lint`: 3 erori, 14 avertismente — aceleași dinainte, în fișiere neatinse. Rulat după fiecare commit de cod.
- `typecheck`: trece (după fiecare commit).
- `build`: trece. În CSS-ul de producție: `dark:` compilat pe `:where(.dark, .dark *)` (74 de reguli), zero `prefers-color-scheme: dark`, clasele `z-*` prezente, nicio definiție veche rămasă.
- `test:critical:unit`: 135 / 137 la rularea completă; cele 2 picate sunt aceleași timeout-uri de 5 s din `integrations/google` (callback + connect) ca la promptul 02. Rerulate separat: 19 / 19.
- Tokeni fără definiție (comanda din `tokens.md`): rămâne doar `--assoc-ink`, folosit cu valoare de rezervă.
- Valoarea fiecărui token (380, zi și noapte) a fost comparată în browser înainte și după aliasuri: niciun token dispărut; diferențele sunt exact cele din tabelele de mai sus.
- Local, 375 px, doar navigare: `/login` cu aplicația pe „Luminos" și sistemul pe întunecat rămâne luminos (bug-ul inițial), și invers; `/comanda` cu foaia de comandă deschisă (fără plasarea comenzii) și `/magazin/asociatie` arată la fel pe ambele teme.
- **Neverificat local:** paginile din dashboard (speed dial-ul, dialogurile peste bara de jos, Comenzi / Livrări / Recoltări, bara din Asociație). Browserul de test nu era autentificat și nu s-a creat niciun cont sau demo. Rămân de văzut pe preview.

## De verificat pe telefon (preview)

| # | Unde | Ce verificați |
|---|---|---|
| 1 | Telefon pe temă **întunecată**, aplicația pe **„Luminos"** (Setări) → `/dashboard`, `/parcele`, `/login`, `/start` | Totul e luminos; nicio zonă închisă la culoare. (Bug-ul inițial.) |
| 2 | Telefon pe temă luminoasă, aplicația pe **„Întunecat"** → `/dashboard`, `/parcele`, `/clienti`, `/cheltuieli` | Totul e închis; niciun panou alb cu text deschis. Verdele e mai stins decât înainte. |
| 3 | Setări → comutare Luminos / Întunecat / Sistem | Se schimbă pe loc, fără reîncărcare, inclusiv bara de jos. |
| 4 | Orice formular vechi (ex. `/cheltuieli` → „+") și o foaie (ex. `/vanzari-butasi` → sortare) | Fereastra și foaia stau peste bara de jos; fundalul întunecat o acoperă. |
| 5 | Același dialog | FAB-ul dispare cât e deschis dialogul și revine la închidere. |
| 6 | Android, o foaie sau un dialog deschis → butonul „înapoi" | Se închide fereastra, nu se schimbă pagina. |
| 7 | `/comenzi` → „+" | Fundalul acoperă bara de jos; „×" e vizibil și închide; „Comandă nouă" și „Din mesaj" deschid formularele. |
| 8 | `/comenzi`, `/livrari`, `/recoltari`, ziua | Arată ca înainte. Excepții așteptate: fâșia gri de sub sumarul din Recoltări și umbra de pe „×". |
| 9 | `/comenzi`, `/livrari`, `/recoltari`, noaptea | Rămân luminoase (tema coral nu are variantă de noapte; dispare la refacerea modulelor). Dialogul de confirmare a livrării e închis la culoare, ca înainte. |
| 10 | Într-un dialog cu selector sau calendar (ex. `/recoltari` → adăugare → parcelă, dată) | Lista și calendarul se deschid peste dialog. |
| 11 | O acțiune care dă notificare (ex. salvarea unei setări) cu un dialog deschis | Notificarea apare peste dialog. |
| 12 | `/comanda` (magazinul public), zi și noapte | Pagina, coșul și foaia de comandă arată ca înainte. **Nu plasați comanda.** |
| 13 | `/magazin/asociatie`, zi și noapte | Pagina, coșul și checkout-ul arată ca înainte. **Nu plasați comanda.** |
| 14 | Cont de asociație → `/asociatie/livrari` | Bara „Livrate x / y" se vede deasupra barei de jos și nu acoperă ultimul card. |
| 15 | `/analytics-magazin` | Pastila activă „7 / 30 / 90 zile" are fundal verde deschis. |
| 16 | Setări → „vizibilitate ridicată" și densitate compactă | Se comportă ca înainte. |
| 17 | Desktop, orice pagină cu antet (ex. `/parcele`) | Meniul de profil și clopoțelul se deschid peste conținut; tabelele cu antet lipicios nu trec peste antet. |

---

# Corecturi fundație (prompt 03b, 19.11.2026)

Branch `redesign/fundatie`. Nimic în baza de date. Nemergeuit în `main`.

## 1. Antetul desktop noaptea (text închis pe verde închis)

- **Cauza din prompt nu se confirmă.** Pe `main`, `globals.css` nu definea `--agri-hero-bg`; singura valoare de noapte era `#0d2318` din `theme.css`. Valorile efective pe `main` (CSS compilat, `.dark` pe `<html>`) și pe producție (`www.zmeurel.ro`) sunt `--agri-hero-bg` #0d2318 și `--text-on-accent` #08140e, aceleași ca pe branch. Componentele antetului nu s-au schimbat decât la z-index. **Bug existent și pe `main`, nu regresie.**
- **Fix (varianta B):** clasa `agri-hero` pe `CompactPageHeader`; noaptea, de la 768 px, `--text-on-accent` alb pe antet (16,5:1). Fundalul rămâne #0d2318. Detalii și contrast în `tokens.md`.
- Între 768 și 1023 px, noaptea, același mecanism repară butoanele dashboard-ului („Editează”, „Widget”, „Anulează”) și meniul de profil.
- Comparația tuturor tokenilor pe CSS-ul compilat (`main` ↔ branch, zi / noapte, 1280 / 375): niciun token de componentă nu diferă în afara listei aprobate. Tabelul e în `tokens.md`.

## 2. Paginile de autentificare noaptea

- **Cauza:** `/reset-password`, `/reset-password-request`, `/update-password` au culori de zi scrise direct, dar `Label` / `Input` luau tokenii de noapte; `/login` avea cardul `bg-white dark:bg-slate-800`.
- **Fix:** `src/app/(auth)/layout.tsx` învelește paginile în `.theme-light` (tema de zi pe subarbore; mecanismul e în `tokens.md`). `/start` neatins, la cerere.

## Fișiere atinse

`src/styles/theme.css`, `src/app/globals.css`, `src/components/layout/CompactPageHeader.tsx`, `src/app/(auth)/layout.tsx` (nou), `docs/redesign/tokens.md`, acest fișier.

## Verificare

- `lint`: aceleași 3 erori și 14 avertismente vechi, după fiecare commit. `typecheck`: trece după fiecare commit. `build`: trece.
- Local (Chromium), `/login`, `/reset-password`, `/reset-password-request`, `/update-password` la 375 și 1280 px: pe toate elementele paginii, culorile, fundalurile, contururile și umbrele calculate noaptea sunt identice cu cele de zi. Diferă doar două elemente din afara învelișului (containerul exterior și zona de notificări). Capturi: `/reset-password` și `/login` cu telefonul pe întunecat și tema „Sistem”.
- **Neverificat local:** antetul pe dashboard (cere cont). Rămâne de văzut pe preview.

## Rămase (în afara corecturii, notate)

- **Dashboard, 768–1023 px, ziua:** butoanele „Editează” / „Widget” / „Anulează” au text alb (`--text-on-accent`) pe fundalul alb al paginii. Dedus din cod, existent și pe `main`; cere altă abordare (alt token pentru zona fără verde), nu `agri-hero`.
- **Asociație → Livrări, pe telefon, noaptea:** pastila „N comenzi” din antet are text #08140e pe fundal închis (sub 768 px regula `agri-hero` nu se aplică). Existent și pe `main`; Asociația e în afara revamp-ului.
- **Pagini de autentificare noaptea:** notificările (toast) rămân închise la culoare, iar la tragerea peste marginea paginii pe iPhone se vede fundalul închis al `body`.

## De verificat pe preview

| # | Unde | Ce verificați |
|---|---|---|
| 1 | Desktop, aplicația pe „Întunecat” → `/dashboard`, `/parcele` | Titlul, data, numele, pastilele (Comenzi, Livrări, Recoltări, Clienți), clopoțelul și meniul de profil: text alb pe verde închis. |
| 2 | Același antet, ziua | Arată ca înainte. |
| 3 | Fereastră de 768–1023 px, noaptea → `/dashboard` | „Editează” și meniul de profil se citesc. |
| 4 | `/comenzi`, `/livrari`, `/recoltari`, desktop, noaptea | Antetul arată ca înainte (tema coral). |
| 5 | Telefon pe întunecat, tema „Sistem” → `/login`, `/reset-password`, `/update-password` | Pagini luminoase, etichete și câmpuri lizibile. Ziua arată ca înainte. |

# Kitul de componente (prompt 04, 19.11.2026)

Branch `redesign/kit`. Nimic în baza de date, nicio migrare. Nemergeuit în `main`, fără PR. Niciun modul refăcut; paginile existente arată ca înainte.

## Ce s-a făcut

**Etapa A — primitive**

- `ui/button.tsx`: mărimile `touch` (48), `touch-lg` (56), `icon-touch`; variantele `primary`, `neutral`, `danger`, `quiet`; prop-ul `loading`. Variantele și mărimile existente sunt neschimbate.
- `src/components/kit/`: `Tile` + `TileGroup`, `Segments`, `FilterPills`, `StatTile`, `StatHero`, `StatusPill`, `EmptyState`, `BigInput` + `BigTextarea`, `ListRow`, `ToggleRow`, `CheckRow`, `Notice`, `ProgressBar`, `ActionCard` + `ActionCardChip`; scara de text în `kit/text.ts`.
- `npm run check:kit` (`scripts/kit-rules.mjs`, `scripts/check-kit-rules.mjs`).
- `/admin/kit`, cu link în meniul „Mai mult” și în bara laterală (doar superadmin).

**Etapa B — compuse**

- `BottomSheet`: rădăcina `Dialog` din `ui/dialog` + `SheetContent` din `ui/sheet`. `ui/sheet` singur nu ascunde butonul plutitor și nu ascultă „înapoi” pe Android; rădăcina `Dialog` le face pe amândouă. Fișierele din `ui/` sunt neatinse.
- `StepForm` + `useStepForm`: navigarea, întoarcerea din recapitulare, resetul la deschidere, ciclul de analytics și cheia de idempotență (`client_sync_id`) sunt în carcasă.
- `CalendarSheet` + `CalendarPanel`, `NumberStepper`, `NumericKeypad`, `KgField` + `useKeypadFields`, `SummaryRow` + `SummaryList`, `SuccessScreen`.
- Regulile kitului în `CLAUDE.md`; scara de text în `tokens.md`.

## Decizii (Andrei, la aprobarea planului și după Etapa A)

- Variantele noi de buton se numesc `primary` / `neutral` / `danger` / `quiet`.
- Scara de text e în `kit/text.ts`, ca șiruri de clase, fără tokeni noi în `globals.css`.
- Link spre `/admin/kit` în `MoreMenuDrawer.tsx` și `Sidebar.tsx`.
- `check:kit` are trei reguli în plus față de prompt: `text-xs`, `zIndex` în `style`, clase `z-40` și mai mari.
- `KgField` nu e `<input>`: e buton cu `aria-pressed`, eticheta spune câmpul, valoarea și starea („Calitatea 1, 27,35 kg, activ”), iar valoarea se anunță la schimbare (`aria-live` politicos).
- `StatusPill` rămâne la 13 px: nu e apăsabilă, nici când stă într-un rând apăsabil.
- „Programate” nu încape într-un rând de 4 segmente la 390 px; se rezolvă în Comenzi cu o etichetă scurtă.

## Abateri față de plan (semnalate)

- `BigInput` e componentă de kit, nu variantă în `ui/input.tsx` (acolo toate clasele sunt pe `--agri-*`). `ui/input.tsx` e neatins.
- `kit/text.ts` exportă și `kitFocus` (conturul de focus comun).
- Insigna plăcii (`Tile`, „✓ azi 35 kg”) stă pe un rând propriu, jos; lângă inițială nu încăpea pe două coloane.
- `ListRow`: detaliul are cel mult două rânduri (o adresă trebuie să se poată citi); titlul rămâne pe un rând.
- `ActionCard`: butoanele secundare au text de 15 px, ca „Navighează” să încapă pe jumătate de lățime.
- `StepForm` are în plus zona `dock`, fixă între conținut și butoane. Fără ea, la 390×800 ultimul rând al tastaturii cerea derulare.
- Zilele din calendar au 2 px între ele (nu 4), ca să rămână de cel puțin 48 px lățime la 390 px.
- Logica de selecție a plăcilor e în `Tile.tsx`, nu într-un fișier separat `lib/selection.ts`. Testul calendarului e `date.test.tsx` (acoperă și `CalendarPanel`).
- Exporturi ajutătoare, pe lângă lista din prompt: `StatHero`, `BigTextarea`, `ActionCardChip`, `CalendarPanel`, `StepFormFrame`, `StepFormTitle`, `SummaryList`.

## Fișiere atinse

Create: `src/components/kit/` (21 de componente, `index.ts`, `text.ts`, `lib/` cu 4 fișiere, `__tests__/` cu 9 fișiere), `src/app/(dashboard)/admin/kit/` (5 fișiere), `scripts/kit-rules.mjs`, `scripts/check-kit-rules.mjs`.

Modificate: `src/components/ui/button.tsx`, `src/components/app/MoreMenuDrawer.tsx`, `src/components/layout/Sidebar.tsx`, `package.json`, `vitest.critical.config.ts`, `CLAUDE.md`, `docs/redesign/tokens.md`, acest fișier.

Neatinse: `ui/input.tsx`, `ui/sheet.tsx`, `ui/dialog.tsx`, `globals.css`, `theme.css`, `src/lib/utils.ts`, toate modulele (inclusiv Material săditor), `public/sw.js`.

## Verificare

- `typecheck`: trece. `check:kit`: trece, 32 de fișiere. `build`: trece. `lint`: aceleași 3 erori și 14 avertismente vechi, niciuna în kit.
- Testele kitului: 107 din 107, în 9 fișiere (tastatura și `KgField`, `Tile`, `CheckRow`, `StepForm`, `BottomSheet`, calendar, numere, regulile `check:kit`).
- `test:critical:unit`: 242 din 244. Cele două picate sunt expirări la 5 secunde în `src/app/api/integrations/google/__tests__/` (`callback.route`, `connect.route`). Pică la fel și fără testele kitului și trec rulate singure; nu vin din acest prompt.
- Local (Chromium), zi și noapte, la 390 și 790 px, pe o rută temporară, ștearsă după și necomisă (pagina reală cere cont de superadmin): toate țintele au cel puțin 48 px, nimic nu iese din cadru, niciun text sub 15 px ca text al unui element apăsabil.
- Comportament verificat local: foaia și formularul pun `data-modal-open` pe `<html>` și marcajul în istoric, se închid la „înapoi” și curăță după ele; formularul demonstrativ merge cap-coadă (întoarcerea din recapitulare, aceeași cheie de idempotență pe o deschidere, alta la „încă o cântărire”, câmpul de kg gol după restart).
- **Etapa A verificată de Andrei pe preview** (zi + noapte, 412 px).
- **Neverificat pe telefon:** Etapa B. Lista e mai jos.

## Rămase

- **„Vizibilitate ridicată” pe setul canonic.** Suprascrie doar numele `--agri-*`; cere modificări în `theme.css` / `globals.css`, deci a rămas în afara promptului 04. Până atunci, în acest mod kitul are țintele mărite (52 / 60), dar culorile obișnuite.
- **Contrastul `--fg-subtle` noaptea** (#6c737d pe #12161d, sub 4,5:1). Cere modificare în `theme.css`. Kitul îl folosește doar pe placeholder.
- **Segmente cu 4 opțiuni la 390 px:** o etichetă de peste 8–9 litere se taie. În Comenzi, „Programate” are nevoie de o formă scurtă.
- **Ferestre suprapuse** (o foaie deschisă peste un formular pe pași): fiecare pune propriul marcaj în istoric. Neverificat cu „înapoi” pe Android; de verificat la primul modul care are nevoie.
- **`ui/sheet.tsx` folosit direct** în module nerefăcute rămâne fără ascunderea butonului plutitor și fără „înapoi”. Se rezolvă pe rând, la refacerea fiecărui modul, prin `BottomSheet`.
- **Material săditor** nu e migrat pe kit (la cerere). Foaia lui locală cu `createPortal` rămâne.
- **Mărimea implicită a butonului** (`ui/button.tsx`, 40 px) e neschimbată; se schimbă la final, cum cere auditul.
- **Expirările din testele `integrations/google`** la rularea întregii suite pe această mașină.

## De verificat pe telefon (preview, `/admin/kit`)

Din „Mai mult” → Admin → „Kit de componente”. Comutatorul „Tema aplicației” de sus schimbă tema pentru foile și ferestrele reale.

| # | Unde | Ce verificați |
|---|---|---|
| 1 | Foaie de jos → „Deschide” | Urcă peste bara de jos; se văd mânerul și colțurile rotunjite; butonul „Da, livrat” nu e acoperit de bara telefonului. |
| 2 | Aceeași foaie, pe Android | Butonul „înapoi” al telefonului închide foaia și rămâneți pe pagină. |
| 3 | Foaie de jos → „Conținut lung” | Lista se derulează; titlul și „Gata” rămân pe loc. |
| 4 | Calendar → „Alege data livrării” | Zilele trecute nu se pot apăsa; după alegere foaia se închide și butonul arată data. Zilele se nimeresc ușor cu degetul. |
| 5 | Număr cu pași | − și + merg; la minim butonul − devine inactiv. La atingerea cifrei se deschide tastatura numerică a telefonului, iar pagina NU se mărește (iPhone). |
| 6 | Tastatură și câmp de kg | Câmpul e gol la început. Tastați 27,35: a doua virgulă și a treia zecimală sunt ignorate. Tastatura telefonului NU se deschide. |
| 7 | Tastatură → „Adaugă calitatea 2” | Apare al doilea câmp, cu contur verde; tastele scriu doar în el. Atingerea primului câmp mută scrisul înapoi. |
| 8 | Formular pe pași → „Adaugă kg” | Se deschide pe tot ecranul. La pasul 2, toate cele 4 rânduri de taste și butonul „Continuă” se văd fără derulare. |
| 9 | Același formular, până la „Verificare” | „Schimbă” la culegător duce la pasul 1, iar după alegere vă întoarce la verificare. Cheia afișată jos rămâne aceeași. |
| 10 | „Salvează”, apoi „Încă o cântărire” | Apare ecranul de reușită; formularul nou pornește gol, iar la verificare cheia e alta. |
| 11 | Același formular, pe Android | „Înapoi” al telefonului închide formularul. |
| 12 | Toate de mai sus, cu tema aplicației pe „Noapte” | Textul se citește, câmpul activ are contur vizibil, tastele se disting de fundal. |
| 13 | Cu un cititor de ecran (TalkBack / VoiceOver), la câmpul de kg | Se aude „Calitatea 1, necompletat, activ”; după fiecare tastă se aude valoarea nouă. |
