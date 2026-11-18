# Redesign UI — progres

Ultima actualizare: 18 noiembrie 2026, după Faza 0b.

| Fază | Stare |
|---|---|
| 0 — Audit UI | **gata**: `docs/redesign/audit.md` |
| 0b — Audit analytics | **gata**: Anexa G, secțiunile 4 și 6 din `audit.md` |
| — Ștergerea fișierelor nefolosite (Anexa E) | decisă; pas separat înainte de Faza 1 |
| 1 — Kit de design | neîncepută |
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
