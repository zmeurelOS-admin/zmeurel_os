# Prompt 04 — Faza 1b: Kitul de componente + pagina `/admin/kit`

Model: Fable 5.2 · Effort: high · Mod: plan · Sesiune: NOUĂ · Branch: `redesign/kit` (existent, din `main` + acest prompt) · Rezultat: `src/components/kit/*`, `/admin/kit`, reguli în `CLAUDE.md`

## Protocol de lucru (obligatoriu)

1. **PLAN** — citește acest fișier, `CLAUDE.md`, `docs/redesign/tokens.md`, `docs/redesign/audit.md` (secțiunile 2, 3.1, 3.2), cele trei mockup-uri aprobate din `docs/redesign/mockups/` (`recoltari.md`, `livrari.md`, `comenzi.md`) și codul de referință din `src/components/vanzari-butasi/` + `src/app/(dashboard)/vanzari-butasi/VanzariButasiPageClient.tsx`. Trimite:
   - API-ul fiecărei componente (props, variante, stări), într-un tabel;
   - ce iei din codul de referință și ce generalizezi;
   - structura de fișiere și lista exactă de fișiere create/modificate;
   - cum arată pagina `/admin/kit`;
   - testele pe care le scrii și comenzile de verificare;
   - împărțirea pe cele două etape de mai jos.
   **STOP. Aștepți aprobarea.**
2. **ETAPA A** (primitivele, lista A) — după „aprobat”. Commit-uri mici. La final: push, raport scurt, link de preview. **STOP. Aștepți „continuă”.**
3. **ETAPA B** (componentele compuse, lista B, plus regulile din `CLAUDE.md`) — după „continuă”. La final: push, raport, link de preview, lista de verificat pe telefon. **STOP. Fără merge.**

## Context

Fundația e în `main`: un singur set de tokeni pe roluri (`bg-surface`, `text-fg`, `border-border`, `shadow-1/2/overlay`, `rounded-control/box/card/sheet`, `h-touch`/`h-touch-lg`), modul noapte pe clasa `.dark`, scara de straturi (`z-nav`, `z-fab`, `z-overlay`, `z-modal`, `z-popover`, `z-toast`). Totul e în `docs/redesign/tokens.md`.

Kitul e baza pentru toate modulele refăcute. Primele trei, cu mockup aprobat: **Recoltări (pilot) → Comenzi + Livrări**. Kitul trebuie să acopere ce cer mockup-urile lor. Nu reface niciun modul în acest prompt.

## Lista A — primitive

| Componentă | Sursă / cerință |
|---|---|
| Butoane: mărimi `touch` (48) și `touch-lg` (56) în `ui/button.tsx`, variante principal / secundar / pericol / fantomă, încărcare, iconiță | audit 3.2; NU un al doilea buton; mărimea implicită existentă NU se schimbă acum |
| `Tile` — placă de alegere (unică/multiplă, `radio`/`checkbox`, coloane, subtitlu, insignă opțională ex. „✓ azi 35 kg”) | `ComandaButasiWizard.tsx:223-257`; plăcile de culegători (Recoltări), cantitate și dată (Comenzi) |
| `Segments` | `VanzariButasiPageClient.tsx:665-690`; 48 px, ARIA `tablist` |
| `FilterPills` | `VanzariButasiPageClient.tsx:~725-740`; derulare orizontală, contor |
| `StatTile` + varianta mare „hero” (card principal plin, ex. totalul zilei la Recoltări) | `VanzariButasiPageClient.tsx:645-659`; tonuri neutru / atenție / inversat |
| `StatusPill` — tonuri neutru / info / succes / atenție / pericol, iconiță opțională (ex. steag „Prioritară”) | `statusInfo` din referință + `StatusBadge` ca API |
| `EmptyState` | `VanzariButasiPageClient.tsx:765-775` |
| `BigInput` — 56 px, text 17 px (min. 16 pentru Safari) | `inputBase`, `ComandaButasiWizard.tsx:270-272`; variantă în `ui/input.tsx` dacă se potrivește |
| `ListRow` — avatar cu inițială, titlu, detaliu, insignă/sumă în dreapta, săgeată | `ComandaButasiWizard.tsx:945-960`; opriri din Livrări, clienți din Comenzi |
| `ToggleRow` — rând cu titlu, subtitlu, comutator (rol `switch`), stare activă evidențiată | mockup-uri: „Salvează locația de aici”, „Prioritară”, „Mut-o la finalul traseului” |
| `CheckRow` — rând bifabil (rol `checkbox`) cu **stare blocată** și motiv (ex. „Nu ajunge stocul: lipsesc 3 kg”) | mockup Comenzi → „Pune în livrare azi” |
| `Notice` — bandă info / atenție / succes / pericol, cu iconiță | mockup Comenzi: „2 prioritare azi · 21 kg — de livrat cu prioritate” |
| `ProgressBar` — bară cu etichetă (ex. „3 din 7 livrate”, „Rămas în stoc”) | mockup Livrări, Comenzi |
| `ActionCard` — card cu zone fixe (titlu, detalii, sumă, pastile, subsol) + un singur buton principal | `ButasiOrderCard`, `VanzariButasiPageClient.tsx:131-252`; „următoarea oprire” din Livrări |

## Lista B — compuse

| Componentă | Sursă / cerință |
|---|---|
| `BottomSheet` — peste `ui/sheet.tsx` (Radix: portal, focus, Esc), cu mâner, colțuri 28, `shadow-overlay`, legat de `modal-layer` (ascunde FAB) și `lib/ui/dialog-history.ts` (butonul „înapoi” Android) | audit 3.2: NU generaliza varianta cu `createPortal` din referință |
| `StepForm` — carcasă: antet (înapoi, „Pasul x din y”, închide, bară de progres), zonă cu scroll, footer cu butonul principal (1 sau 2 butoane) | carcasa `ComandaButasiWizard.tsx:1444-1506`, logica `:511-534`; ciclul de analytics (`open_create_form` → `create_success`/`create_failed`/`form_abandoned`) și cheia de idempotență (`client_sync_id`) trăiesc în carcasă, nu în fiecare modul |
| `CalendarSheet` — calendar în foaie, scurtături Azi / Mâine / Poimâine, limite min/max, română | `CalendarPanel`, `ComandaButasiWizard.tsx:278-403` |
| `NumberStepper` — mare și compact, pași configurabili, zecimale, unitate, limite | `ComandaButasiWizard.tsx:1070-1170` |
| `NumericKeypad` + `KgField` — tastatură numerică mare în aplicație (1–9, virgulă, 0, ștergere; taste ≥ 54 px) care scrie în câmpul activ; **câmpul pornește GOL, fără valoare propusă**; virgulă zecimală, max. 2 zecimale, o singură virgulă; câmpul activ cu contur `primary`; mai multe câmpuri (ex. calitatea 1 / calitatea 2) | mockup Recoltări (decizie: cantitatea se tastează, cântarul dă zecimale) |
| `SummaryRow` — etichetă, valoare, acțiune „Schimbă” | `ComandaButasiWizard.tsx:1296-1308` |
| `SuccessScreen` | `ComandaButasiWizard.tsx:752-780` |

## Pagina `/admin/kit`

- Rută în zona admin existentă (protejată de `(dashboard)/admin/layout.tsx`, doar superadmin).
- Fiecare componentă vie, cu toate stările (normal, activ, dezactivat, blocat, încărcare, gol), în două coloane de 390 px: **zi** și **noapte** (coloana de noapte învelită în `.dark`).
- Exemple compuse din mockup-uri: placa de culegător cu insignă, câmpul de kg cu tastatura, rândul „Pune în livrare” blocat pe stoc, `ToggleRow` „Prioritară”, `ActionCard` „următoarea oprire”.
- Fără date reale, fără apeluri la baza de date.

## Reguli pentru cod (le scrii și în `CLAUDE.md` la finalul etapei B)

- Componentele kitului folosesc DOAR tokenii canonici din `tokens.md`: fără hex, fără `dark:`, fără `--agri-*` / `--text-primary` / `--surface-card` / `--status-*` / `--soft-*`, fără `text-[...]` sub 13 px, fără z-index numeric (doar clasele de strat).
- Scara de text 26/22/19/17/15/13 (+64 cifra mare); 13 doar text ajutător, niciodată pe ceva apăsabil. Câmpuri ≥ 16 px (folosim 17).
- Ținte de atingere ≥ 48 px, acțiunea principală 56 px; citesc `--touch-control-h*` (densitate, vizibilitate ridicată).
- Foile și dialogurile se deschid în portal, peste bara de jos (`z-modal`).
- Text în română; ARIA corect (roluri `radio`/`checkbox`/`switch`/`tablist`, `aria-pressed`/`aria-checked`, etichete pe butoanele doar-iconiță).
- **Verificare automată**: un script `scripts/check-kit-rules.mjs` + `npm run check:kit` care pică dacă în `src/components/kit/` apare: hex, `dark:`, `--agri-`, `--text-primary`, `--surface-card`, `--status-`, `--soft-`, `text-[` sub 13 px, `z-[`. Folderele modulelor refăcute se adaugă pe listă pe rând.
- Fiecare componentă e exportată din `src/components/kit/index.ts`.

## Teste

- Unitare (vitest, cum sunt cele din `test:critical:unit`) pentru logică: `NumericKeypad`/`KgField` (gol la start, o virgulă, max. 2 zecimale, ștergere, câmp activ), `CheckRow` (blocat nu se poate bifa), `StepForm` (navigare, ciclul de analytics apelat o singură dată, cheie de idempotență stabilă pe deschidere), `Tile` (unică vs multiplă).
- `npm run lint` (3 erori vechi acceptate), `npm run typecheck`, `npm run check:kit`, `npm run build`, `npm run test:critical:unit` + testele noi.

## Reguli de lucru

- Nu refaci niciun modul și nu schimbi aspectul paginilor existente. Singura atingere în afara kitului: mărimile noi din `ui/button.tsx` (și `ui/input.tsx`, dacă e cazul) — fără schimbarea celor existente.
- Material săditor NU se migrează pe kit în acest prompt.
- `public/sw.js` nu intră în niciun commit.
- Fără migrări, nimic în baza de date. Nu faci merge în `main`, nu deschizi PR.

NEVER delete, truncate, or modify any user data in the database. Do not run DELETE, UPDATE, or TRUNCATE on production data tables. Do not reset or seed over existing data.
