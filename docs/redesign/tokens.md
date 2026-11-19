# Tokeni de design — referință

Valabil din Faza 1a (prompt 03, 18 noiembrie 2026). Sursa: `src/styles/theme.css` (valori) și `src/app/globals.css` (`@theme`, layout).
Referință pentru Faza 1b (kit) și pentru fiecare modul refăcut.

## Cum e organizat

| Unde | Ce conține |
|---|---|
| `theme.css`, secțiunea 1 | **Setul canonic**: valorile de zi (`:root`) și de noapte (`.dark`). Singurul loc unde se schimbă o culoare. |
| `theme.css`, secțiunea 2 | **Aliasuri**: numele vechi (`--agri-*`, `--surface-*`, `--text-*`, `--status-*`, `--soft-*`, shadcn) trimit spre setul canonic. Declarate o singură dată. |
| `theme.css`, secțiunea 3 | **Tokeni de componentă** păstrați cu valoarea lor (brand, indicatori, CTA, AI, skeleton). |
| `globals.css` `:root` | Doar layout: zone sigure, înălțimea barei de jos, atingere. |
| `globals.css` `@theme inline` | Clasele Tailwind ale setului canonic (și cele shadcn). |
| `globals.css` `@theme static` | Scara de straturi și razele noi. |
| `src/lib/utils.ts` | `tailwind-merge` știe clasele noi. **Orice clasă nouă de tip `z-*`, `rounded-*`, `shadow-*`, `*-touch` se adaugă și acolo.** |

Modul noapte: `dark:` ascultă de clasa `.dark` de pe `<html>` (pusă de `next-themes`), nu de tema telefonului. Aliasurile preiau singure valoarea de noapte, fiindcă `.dark` stă pe același element ca `:root`.

## Reguli de folosire (cod nou și module refăcute)

1. Folosești **clasele** din tabelele de mai jos (`bg-surface`, `text-fg-muted`, `border-border`), nu `[var(--…)]` și nu culori scrise direct.
2. Nu folosești numele din secțiunile 2 și 3 (`--agri-*`, `--text-primary`, `--surface-card`, `--status-*`, `--soft-*` …). Ele există doar pentru modulele încă nerefăcute.
3. Nu scrii `dark:` pentru culori: tokenii au deja valoare de noapte. `dark:` rămâne pentru cazuri rare (o umbră, o imagine).
4. Textul se numește `fg` (`text-fg`), nu `text`: `text-muted` e deja ocupat de shadcn (`--color-muted`, o culoare de fundal), iar `--text-*` e spațiul Tailwind pentru mărimi de font.
5. Stările se folosesc în pereche: `bg-danger-bg text-danger-text border-danger-border`. Culoarea plină (`bg-danger`) e pentru butoane și puncte, cu text `text-primary-contrast`.
6. Un alias se șterge când numărul lui de utilizări ajunge la 0.

## Setul canonic

### Suprafețe, text, contur, principal

| Token | Zi | Noapte | Clasă | Aliasuri vechi | Când îl folosești |
|---|---|---|---|---|---|
| `--page` | #ffffff | #0b0e13 | `bg-page` | `--surface-page`, `--agri-bg`, `--background`, `--bg-primary` | fundalul paginii |
| `--surface` | #ffffff | #12161d | `bg-surface` | `--surface-card`, `--agri-surface`, `--card`, `--bg-card`, `--input-bg` | carduri, foi, ferestre, câmpuri |
| `--surface-muted` | #ededeb | #171c23 | `bg-surface-muted` | `--surface-card-muted`, `--agri-surface-muted`, `--muted`, `--secondary`, `--bg-secondary`, `--pill-inactive-bg` | zone estompate, pastile inactive, rânduri de sumar |
| `--surface-raised` | #ffffff | #1d232c | `bg-surface-raised` | `--surface-card-elevated`, `--surface-elevated`, `--popover`, `--button-muted-bg`, `--fab-surface` | elemente care plutesc peste suprafață: liste derulante, notificări |
| `--fg` | #102015 | #f5f6f7 | `text-fg` | `--text-primary`, `--agri-text`, `--foreground`, `--card-foreground`, `--popover-foreground`, `--secondary-foreground`, `--accent-foreground`, `--pill-inactive-text`, `--button-muted-text` | text principal |
| `--fg-muted` | #3d4a41 | #949ba4 | `text-fg-muted` | `--text-secondary`, `--agri-text-muted`, `--muted-foreground`, `--text-muted` | text secundar, etichete |
| `--fg-subtle` | #64748b | #6c737d | `text-fg-subtle` | `--text-tertiary`, `--text-hint`, `--input-placeholder` | text ajutător, placeholder; niciodată pe ceva apăsabil |
| `--border-subtle` | rgba(16,32,21,.08) | rgba(148,155,164,.12) | `border-border-subtle` | `--divider`, `--surface-divider` | linii despărțitoare în interiorul unui card |
| `--border` | #d7e2d9 | #20262f | `border-border` | `--border-default`, `--border-color`, `--input`, `--input-border` | conturul implicit |
| `--border-strong` | #c8d4cb | #2d343e | `border-border-strong` | `--agri-border`, `--pill-inactive-border` | contur care trebuie văzut: câmpuri, pastile |
| `--primary` | #3d7a5f | #5ca882 | `bg-primary`, `text-primary`, `border-primary`, `ring-primary` | `--agri-primary`, `--accent-green`, `--ring`, `--focus-ring`, `--pill-active-bg`, `--pill-active-border`, `--fab-text` | acțiunea principală, selecția, focus |
| `--primary-contrast` | #ffffff | #08140e | `text-primary-contrast` | `--primary-foreground`, `--agri-primary-contrast`, `--text-on-accent`, `--accent-green-contrast`, `--pill-active-text` | text și iconițe pe `bg-primary` (nu `text-white`: noaptea e închis) |
| `--primary-soft` | #e6f3ea | #0f2218 | `bg-primary-soft` | `--accent`, `--agri-primary-muted` | fundal de selecție discretă, hover |

`--primary` și `--border` sunt chiar numele shadcn, preluate ca tokeni canonici. Restul numelor shadcn sunt aliasuri, deci `bg-muted`, `text-muted-foreground`, `bg-card`, `bg-popover`, `bg-destructive` merg în continuare (o componentă shadcn adusă cu CLI-ul arată corect fără modificări).

### Stări

| Stare | Plin (`--x`) | Fundal (`--x-bg`) | Text (`--x-text`) | Contur (`--x-border`) | Aliasuri vechi |
|---|---|---|---|---|---|
| `success` — zi | #15803d | #ecfdf3 | #15803d | #86efac | `--status-success-*`, `--soft-success-*`, `--success-surface` (= `-bg`), `--value-positive` (= plin) |
| `success` — noapte | #6fbe95 | #0f1d16 | #6fbe95 | #1d4a36 | |
| `warning` — zi | #b45309 | #fffbeb | #b45309 | #fde68a | `--status-warning-*`, `--soft-warning-*` |
| `warning` — noapte | #c9a154 | #1d1812 | #c9a154 | #4a3a1f | |
| `danger` — zi | #dc2626 | #fef2f2 | #b91c1c | #fecaca | `--status-danger-*`, `--soft-danger-*`, `--destructive`, `--value-negative`, `--agri-danger` (= plin) |
| `danger` — noapte | #e0796a | #1f1416 | #e0796a | #4a2620 | |
| `info` — zi | #2563eb | #eff6ff | #1d4ed8 | #bfdbfe | `--status-info-*`, `--soft-info-*` |
| `info` — noapte | #6fa3e0 | #131a26 | #6fa3e0 | #24344a | |
| `neutral` — zi | — | #f8fafc | #475569 | #e2e8f0 | `--status-neutral-*` |
| `neutral` — noapte | — | #171b22 | #c5cad1 | #2d343e | |

Clase: `bg-success`, `bg-success-bg`, `text-success-text`, `border-success-border` (la fel pentru `warning`, `danger`, `info`; `neutral` are doar `-bg`, `-text`, `-border`).

### Umbre

| Token | Zi | Noapte | Clasă | Aliasuri vechi | Când |
|---|---|---|---|---|---|
| `--elevation-1` | 0 1px 3px rgba(16,32,21,.06) | 0 1px 3px rgba(0,0,0,.4) | `shadow-1` | `--shadow-soft`, `--shadow-card-soft` | card |
| `--elevation-2` | 0 6px 18px rgba(16,32,21,.1) | 0 8px 20px rgba(0,0,0,.5) | `shadow-2` | `--shadow-elevated`, `--shadow-card-raised`, `--agri-shadow`, `--shadow-glow` | element ridicat: FAB, buton plutitor |
| `--elevation-overlay` | 0 1px 2px rgba(120,100,70,.05), 0 10px 26px rgba(120,100,70,.08) | 0 1px 3px rgba(0,0,0,.22), 0 10px 28px rgba(0,0,0,.3) | `shadow-overlay` | `--agri-elevated-shadow`, `--agri-elevated-shadow-hover` | foi și ferestre |

Variabila se numește `--elevation-*`, clasa `shadow-*` (în `@theme`, `--shadow-*` e spațiul Tailwind pentru clase).

### Raze

| Token | Valoare | Clasă | Când | Alias vechi |
|---|---|---|---|---|
| `--radius-control` | 12px | `rounded-control` | elemente mici: pastile, bife, etichete | — |
| `--radius-box` | 16px | `rounded-box` | butoane, câmpuri, dale | `--agri-radius` |
| `--radius-card` | 22px | `rounded-card` | carduri | `--agri-radius-lg` |
| `--radius-sheet` | 28px | `rounded-sheet` | foi de jos, ferestre | — |
| — | — | `rounded-full` | pastile rotunde, avatare | — |

Clasele vechi `rounded-sm` (12), `rounded-md` (14), `rounded-lg` (16), `rounded-xl` (20) rămân neschimbate pentru modulele nerefăcute. În cod nou se folosesc doar cele patru de mai sus. Corespondență la migrare: 10 și 14 → 12; 18 → 16; 20 → 22; 24 și 26 → 28.

### Atingere

| Clasă | Valoare | Sursă |
|---|---|---|
| `h-touch`, `min-h-touch`, `size-touch`, `w-touch` | 48px | `--touch-control-h` |
| `h-touch-lg`, `min-h-touch-lg`, `size-touch-lg` | 56px | `--touch-control-h-lg` |

Minim 48 pentru orice e apăsabil, 56 pentru acțiunea principală. Valorile urmează setările utilizatorului: „vizibilitate ridicată" le urcă la 52 / 60, densitatea compactă le coboară la 44 / 50 (`globals.css`, `html.high-visibility-mode` și `html[data-density='compact']`). De aceea kitul folosește clasele, nu pixeli ficși.

## Scara de text

Nu sunt tokeni încă (îi fixează kitul, prompt 04). Regula:

| Treaptă | Mărime | Pentru |
|---|---|---|
| Cifră mare | 64px | câmpul numeric de pe un ecran dedicat (cantitate) |
| Titlu de ecran | 26px | |
| Titlu de secțiune | 22px | |
| Titlu de card | 19px | |
| Text de bază, câmpuri | 17px | câmpurile de introducere au minimum 16px (sub 16, Safari pe iPhone mărește pagina la focus); folosim 17 |
| Text secundar | 15px | |
| Text ajutător | 13px | doar text ajutător; niciodată pe ceva apăsabil. Nimic sub 13. |

## Scara de straturi

| Token | Valoare | Clasă | Pentru | Aplicat în |
|---|---|---|---|---|
| `--z-index-sticky` | 20 | `z-sticky` | bare lipicioase din pagină | (rezervat pentru kit) |
| `--z-index-bar` | 40 | `z-bar` | antetul paginii, bara de acțiune fixă a paginii | `AppShell`, `CompactPageHeader` |
| `--z-index-nav` | 50 | `z-nav` | bara de jos | `BottomTabBar` |
| `--z-index-fab` | 60 | `z-fab` | butonul plutitor | `UnifiedMobileFab` |
| `--z-index-overlay` | 1000 | `z-overlay` | fundalul ferestrelor | `modal-overlay-classes`, speed dial Comenzi |
| `--z-index-modal` | 1010 | `z-modal` | dialog, foaie, alertă | `ui/dialog`, `ui/sheet`, `ui/alert-dialog` (deci și `AppDialog`, `AppDrawer`) |
| `--z-index-popover` | 1020 | `z-popover` | liste derulante, calendar, tooltip | `ui/popover`, `ui/select`, `ui/app-select`, `ui/app-date-picker`, `ui/tooltip` |
| `--z-index-toast` | 1030 | `z-toast` | notificări | `Toaster` |

Reguli:
- Conținutul paginii **nu** mai are strat propriu (`AppShell` nu mai pune `z-10`). Un element `fixed` din pagină concurează direct cu bara de jos și cu FAB-ul, deci trebuie să folosească o clasă din scară.
- Clasele numerice mici (`z-10` … `z-30`) rămân permise doar pentru ordinea din interiorul unei componente (coloane lipicioase, antetul unui dialog). Nimic numeric ≥ 40 în pagini.
- Suprapunerile noi se construiesc peste `ui/dialog` / `ui/sheet` (portal, capcană de focus, ascunderea FAB-ului prin `data-modal-open`, butonul „înapoi" pe Android).

Rămase pe valori vechi, în afara scării (nu se ciocnesc): `Sidebar` 40, `beta-widget` 40, `PushPermissionBanner` 45, `UserProfileMenu` 60 / 70, `PWAInstallPrompt` 70, `AiBottomSheet` 80 / 81, `RouteTransitionIndicator` 120, foaia din Material săditor 1001 (portal), sugestiile de clienți din Comenzi 1100 (portal), magazinul public (`comanda/ShopClient` 59 / 60, `Gust*` 300, `MarketSuccessOverlay` 1200).

## Tokeni de componentă păstrați (secțiunea 3)

Nu au rol echivalent; își păstrează valoarea de zi. Nu se folosesc în cod nou.

`--brand-*` (11), `--indicator-*` (5), `--badge-tip-*`, `--cta-*`, `--whatsapp-green`, `--status-purple-*`, `--ai-sheet-*` (chat-ul AI, neatins), `--skeleton-*`, `--agri-hero-bg`, `--agri-hero-shadow`, `--agri-border-card`, `--agri-border-w`, `--agri-focus-ring`, `--agri-field-*`, `--agri-button-hover-shadow`, `--card-border-default` (cardul de comandă), `--surface-elevated-hover`, `--button-muted-border`, `--button-muted-hover-bg`, `--pill-inactive-hover-bg`, `--fab-border`.

Noaptea, cei care erau pe slate-albastru au trecut pe paleta neutră: `--button-muted-border` → `--border-strong`, `--button-muted-hover-bg` și `--pill-inactive-hover-bg` → #242b35, `--skeleton-base` → #1d232c, `--fab-border` → `--border-strong`, `--agri-focus-ring` → verdele nou.

## Ce s-a schimbat ca valoare la unificare

Regula: ziua, unde două seturi paralele aveau valori diferite, a câștigat varianta cu contrast mai bun. Noaptea, tot ce era pe slate-albastru a trecut pe paleta neutră din `theme.css`.

### Zi

| Token (și aliasuri) | Înainte | După | Locuri |
|---|---|---|---|
| `--text-secondary`, `--muted-foreground` | #526057 | #3d4a41 | 415 + 2 `var()`, 43 clase `text-muted-foreground` |
| `--danger-text`, `--status-danger-text` | #dc2626 | #b91c1c | 42 + 71 |
| `--info-text`, `--status-info-text` | #2563eb | #1d4ed8 | 23 + 14 |
| `--value-positive` | #16a34a | #15803d | 6 |
| `--muted` | #eef3ee | #ededeb | 2 `var()` + 1 clasă `bg-muted` |
| `--secondary` | #f4f7f4 | #ededeb | 2 clase `bg-secondary` |
| `--accent-foreground` | #12331f | #102015 | 1 clasă |
| `--agri-shadow` | 0 1px 2px rgba(120,100,70,.04), 0 6px 18px rgba(120,100,70,.07) | 0 6px 18px rgba(16,32,21,.1) | 17 `.agri-card` + cardurile shadcn pe mobil (12 fișiere) |
| `--text-muted` (era nedefinit) | — (moștenea culoarea părintelui) | #3d4a41 | 16 |
| `--surface-muted` (era nedefinit) | — (transparent) | #ededeb | 2 (`RecoltariPageClient.tsx:249`) |
| `--border-subtle` (era nedefinit) | — (culoarea textului) | rgba(16,32,21,.08) | 2 (`AssociationProducatoriClient.tsx:373`) |
| `--shadow-glow` (era nedefinit) | — (fără umbră) | 0 6px 18px rgba(16,32,21,.1) | 1 (`ComenziSpeedDial.tsx:67`) |
| `--success-surface` (era nedefinit) | — (transparent) | #ecfdf3 | 1 (`analytics-magazin/page.tsx:162`) |

Fără efect vizibil (0 utilizări): `--bg-secondary` #f7f8fa → #ededeb, `--agri-primary-muted` #e8f3ee → #e6f3ea, `--agri-danger` #c63b3b → #dc2626, `--agri-elevated-shadow-hover`.

În Comenzi / Livrări / Recoltări, tema coral (`zmeurel-orders.module.css`, clasa `.theme`) își suprascrie singură `--text-secondary`, `--danger-text`, `--status-danger-text`, `--info-text`, `--status-info-text`, `--value-positive` și `--agri-text-muted`, deci schimbările de mai sus nu ajung în pagină. Ajung doar în ferestrele deschise în portal și în cele două rânduri marcate „era nedefinit".

### Noapte (63 de tokeni; cei care se văd)

| Ce | Înainte | După |
|---|---|---|
| Verdele principal (`--primary`, `--agri-primary`, `--ring`, `--accent-green`) | #4ade80 | #5ca882 |
| Text pe verde (`--primary-foreground`, `--agri-primary-contrast`) | #052e16 | #08140e |
| Carduri `--agri-surface` | #1a2538 | #12161d |
| shadcn: `--background` / `--card` / `--popover` / `--muted` / `--secondary` | #0f172a / #1e293b / #334155 / #334155 / #1e293b | #0b0e13 / #12161d / #1d232c / #171c23 / #171c23 |
| shadcn: `--border` / `--input` | #334155 / #475569 | #20262f |
| `--accent` | #334155 | #0f2218 |
| `--agri-border` | #20262f | #2d343e |
| Pastilă activă (`--pill-active-bg` / `-text`) | #166534 / #f0fdf4 | #5ca882 / #08140e |
| Pastilă inactivă (`--pill-inactive-bg` / `-border`) | #24324a / #334155 | #171c23 / #2d343e |
| Buton estompat (`--button-muted-bg` / `-border`) | #334155 / #475569 | #1d232c / #2d343e |
| Stări `--soft-*` | nuanțe translucide pe slate (text #4ade80 / #fbbf24 / #f87171 / #60a5fa) | cele din `theme.css` (text #6fbe95 / #c9a154 / #e0796a / #6fa3e0) |
| `--destructive`, `--value-negative` | #f87171 | #e0796a |
| `--value-positive` | #4ade80 | #6fbe95 |
| `--skeleton-base` | #243449 | #1d232c |
| `--agri-shadow` | 0 1px 2px rgba(0,0,0,.2), 0 6px 20px rgba(0,0,0,.24) | 0 8px 20px rgba(0,0,0,.5) |

De știut: `--fg-subtle` noaptea (#6c737d pe #12161d) are contrast sub 4,5:1. Valoarea e cea de dinainte; se reglează în kit.

## Antetul paginii noaptea (`agri-hero`, prompt 03b)

`CompactPageHeader` (deci orice `PageHeader`) are clasa `agri-hero`. Pe desktop, fundalul antetului e `--agri-hero-bg` și textul `--text-on-accent`. Noaptea, `--text-on-accent` e închis (#08140e, gândit pentru butoanele pline), iar pe #0d2318 dădea 1,14:1. Bug-ul exista și pe `main`. Nu e o regresie.

Regula din `theme.css`: `@media (min-width: 768px) { .dark .agri-hero { --text-on-accent: #ffffff } }`. Alb pe #0d2318: 16,5:1; subtitlul (84 %): 11,0:1; pastilele: 7,5–9,2:1. Între 768 și 1023 px repară și butoanele dashboard-ului și meniul de profil, care stau pe fundalul paginii. `--primary-foreground` / `--primary-contrast` rămân neatinse (butoanele pline). În Comenzi / Livrări / Recoltări tema coral avea deja `#fff`.

## Subarbore pe tema de zi (`.theme-light`, prompt 03b)

Pentru paginile care trebuie să rămână luminoase indiferent de temă (acum: tot ce e în `src/app/(auth)`, prin `(auth)/layout.tsx`).

- Blocurile de zi din cele trei secțiuni ale `theme.css` sunt declarate `:root, .theme-light`. Aliasurile trebuie redeclarate și ele: o variabilă cu `var()` se calculează pe elementul unde e declarată, deci altfel ar rămâne valoarea de noapte de pe `<html>`.
- `.theme-light` primește și `color-scheme: light` și `color: var(--agri-text)` (textul moștenit din `body` era cel de noapte).
- Varianta `dark:` (`globals.css`) exclude subarborele: `&:where(.dark, .dark *):not(:where(.theme-light, .theme-light *))`.
- „Vizibilitate ridicată” se aplică și înăuntru (`html.high-visibility-mode .theme-light`).
- Ce rămâne în afara învelișului: notificările (toast) și fundalul `body` (vizibil doar la tragerea peste marginea paginii pe iPhone).
- Un token nou de zi se adaugă în blocul `:root, .theme-light` corespunzător; nu e nevoie de altă modificare.

## Comparație `main` ↔ `redesign/fundatie` pe CSS-ul compilat (prompt 03b)

Metodă: `globals.css` + `theme.css` de pe fiecare ref, compilate cu `@tailwindcss/postcss` (cu optimizarea lightningcss, ca la build); valorile calculate de Chromium pe `<html>`, cu clasa `light` și cu `.dark`, la 1280 și 375 px. 277 de nume, 102 diferă. La 375 px diferențele sunt identice cu cele de la 1280.

### Tokeni de componentă păstrați (secțiunea 3)

| Grup | Zi | Noapte | Stare |
|---|---|---|---|
| `--agri-hero-bg`, `--agri-hero-shadow`, `--text-on-accent` (pe `<html>`) | = | = | identic (`--text-on-accent` se schimbă doar în antet, vezi mai sus) |
| `--brand-*` (11), `--indicator-*` (5), `--cta-*` (8), `--badge-tip-*`, `--status-purple-*`, `--whatsapp-green` | = | = | identic |
| `--ai-sheet-*`, `--card-border-default`, `--surface-elevated-hover`, `--agri-border-w`, `--agri-button-hover-shadow`, `--agri-field-h`, `--agri-field-idle-shadow` | = | = | identic |
| `--skeleton-base` | = | #243449 → #1d232c | aprobat (secțiunea 3, nota de noapte) |
| `--button-muted-border` | = | #475569 → #2d343e | aprobat (idem) |
| `--button-muted-hover-bg` | = | #475569 → #242b35 | aprobat (idem) |
| `--pill-inactive-hover-bg` | = | #2b3a54 → #242b35 | aprobat (idem) |
| `--fab-border` | = | #475569 → #2d343e | aprobat (idem) |
| `--agri-focus-ring` | = | verde #4ade80 35 % → #5ca882 32 % | aprobat (idem) |
| `--agri-border-card` | = | urmează `--agri-border` (#20262f → #2d343e) | aprobat (tabelul „Noapte”) |
| `--agri-field-focus-ring`, `--agri-field-error-ring` | = | urmează `--agri-primary` / `--destructive` | aprobat (tabelul „Noapte”) |
| `--agri-elevated-shadow-hover` | 0 2px 4px / 0 12px 32px → valoarea `--elevation-overlay` | idem | aprobat, 0 utilizări |

Niciun token de componentă nu diferă în afara listei aprobate; nimic de readus la valoarea de pe `main`.

### Restul diferențelor

- **Ziua:** exact cele 13 din tabelul „Zi” de mai sus (`--text-secondary`/`--muted-foreground`, `--danger-text`, `--info-text`, `--value-positive`, `--muted`, `--secondary`, `--accent-foreground`, `--agri-shadow`, cele 5 „era nedefinit”) și cele 4 fără efect.
- **Noaptea:** aliasurile trecute pe paleta neutră (tabelul „Noapte”). Pe lângă cele numite acolo: `--fab-text` (#e2e8f0 → #5ca882), `--fab-surface`, `--input-bg`, `--input-border` — 0 utilizări, nu se văd; `--button-muted-text`, `--foreground`, `--card-foreground`, `--popover-foreground`, `--secondary-foreground`, `--pill-inactive-text` (#e2e8f0 / #f1f5f9 / #f8fafc → #f5f6f7) — diferență abia vizibilă.
- **Nume noi** (lipsă pe `main`): setul canonic, `--radius-control/box/card/sheet`, `--z-index-*`.

## Verificare: tokeni folosiți fără definiție

```bash
comm -23 <(git grep -ohE "var\(--[a-zA-Z0-9_-]+" -- src | sed 's/var(//' | sort -u) <(git grep -ohE "(^|[^a-zA-Z0-9_-])--[a-zA-Z0-9_-]+['\"]?[[:space:]]*:" -- src | grep -oE "\-\-[a-zA-Z0-9_-]+" | sort -u) | grep -vE "^--(tw-|radix-|font-|color-|spacing$|shadow-(sm|md)$)"
```

Rezultatul așteptat este un singur rând: `--assoc-ink` (magazinul asociației; e folosit cu valoare de rezervă, `var(--assoc-ink, #0c0f13)`). Orice alt nume e un token fără definiție. `--shadow-sm` și `--shadow-md` nu apar fiindcă le emite Tailwind din tema lui implicită.

## Ce nu acoperă fundația

- `src/styles/zmeurel-orders.module.css` (tema coral) e neatins; dispare la refacerea Recoltărilor, apoi a perechii Comenzi + Livrări.
- `gusta-brand.css`, `association-shop.css`, `comanda/comanda.module.css` (magazinul public) și `src/lib/design-tokens.ts` au valorile lor și nu țin de acest set.
- „Vizibilitate ridicată" suprascrie doar numele `--agri-*`, ca înainte. Trecerea ei pe setul canonic se face odată cu kitul.
- `tailwind.config.ts` nu e încărcat de nimic (Tailwind 4 citește doar CSS-ul); poate fi șters într-un pas de curățenie.
