# Audit UI — Faza 0 (doar citire)

Branch `redesign/audit`, HEAD `1e3ca48`, 18 noiembrie 2026. Niciun fișier din `src/` nu a fost modificat.
Completat în Faza 0b (18 noiembrie 2026): interogările de analytics au rulat pe producție (Anexa G), iar ordinea modulelor ține cont de ele și de deciziile din secțiunea 6.
Cifrele vin din comenzi rulate pe acest HEAD (Anexa F). Exemplele `cale:linie` au fost deschise și confirmate.
Zone folosite la defalcare: **dashboard** = `src/app/(dashboard)` + componentele modulelor; **admin**; **comun** = `components/ui|app|layout|mobile`; **public** = magazin, comandă, livrator, landing, auth, onboarding; **css**; **lib**.

---

## Rezumat

### Top 10 probleme

| # | Problemă | Gravitate | Mărime |
|---|---|---|---|
| 1 | Conținutul fiecărei pagini e închis într-un strat `z-10` (`AppShell.tsx:26`), iar bara de jos (z 50) și butonul plutitor (z 42) stau în afara lui. Orice suprapunere randată în pagină, fără portal, ajunge sub ele oricât de mare i-ar fi z-index-ul. | **blocant** | 1 cauză; 3 locuri active azi (speed dial Comenzi, bara de sumar din Livrări asociație, meniuri `absolute`) |
| 2 | Clasele `dark:` urmează tema telefonului, nu tema aleasă în aplicație. `globals.css` nu are `@custom-variant dark`, iar `tailwind.config.ts` (`darkMode: 'class'`) nu e încărcat de Tailwind 4. | **mare** | 209 apariții / 25 fișiere |
| 3 | Comenzi, Livrări și Recoltări au o temă proprie, doar de zi (`zmeurel-orders.module.css`: 111 tokeni, 95 îi suprascriu pe cei globali, niciun `.dark`). În modul noapte rămân luminoase. | **mare** | 4 fișiere o aplică, 8 locuri |
| 4 | Tokenii nu sunt în 3 familii, ci în ~12, plus un modul JS. Trei seturi paralele pentru stări, cu valori diferite. 7 tokeni sunt folosiți fără să fie definiți nicăieri. | **mare** | 210 tokeni definiți; 33 utilizări de tokeni inexistenți; 35 definiți și nefolosiți |
| 5 | Niciun buton din kit-ul actual nu atinge 48 px: cele 8 mărimi din `ui/button.tsx` au 24–44 px, câmpurile 44 px. | **mare** | 277 `<Button>`, 356 `<button>` brute |
| 6 | Text sub 13 px peste tot. | **mare** | 666 `text-xs` + 335 `text-[<13px]` (111 la ≤10 px) + 94 `fontSize` inline |
| 7 | Formulare vechi: `AppDrawer` nu e sertar — e același dialog centrat ca `AppDialog`. Toate câmpurile odată (până la 14). Comanda are două formulare de editare diferite. | **mare** | ~20 de formulare în 10 module |
| 8 | Fișiere uriașe care țin listă + formular + dialoguri la un loc. | **mare** | 5 fișiere peste 1.600 de linii (max. 3.291) |
| 9 | Componente duplicate și cod nefolosit. | **mic** | 7 carduri, 4 pastile de status, 5 KPI, 4 stări goale; 36 de fișiere nereferite (6.475 linii) |
| 10 | Culori puse direct și stiluri inline. În dashboard sunt relativ puține; grosul e în zona publică. | **mic** (dashboard) | dashboard: 65 hex, 78 clase de paletă, 257 `style={{`; public: 590 hex |

Alte constatări scurte: chat-ul AI nu poate fi deschis din interfață (nimeni nu apelează `openAiPanel`); `/clienti-magazin` și `/analytics-magazin` nu folosesc `AppShell` și apar doar în meniul de desktop; etichete tehnice vizibile („unit_label”, „approximate_weight”, „Edit”, „Delete”).

### Ordinea propusă pentru module

Actualizată după analytics și deciziile din 18.11.2026 (secțiunea 6). Toate pasele: doar varianta de telefon; desktopul actual nu are voie să se strice.

| Pas | Module | De ce aici |
|---|---|---|
| — | **Ștergerea fișierelor nefolosite** (Anexa E), pas separat înainte de Faza 1 | Decis; cu build de control. |
| 0 | **Fundația** (în Faza 1, fără schimbări vizibile în module) | Problemele 1, 2, 4 și 5 se repară o singură dată, global; un singur set de tokeni, fără tema coral. |
| 1 | **Recoltări** (pilot) | Un singur formular de 7 câmpuri, cel mai bine acoperit de teste, în bara de jos. A 4-a ca folosire, cu folosire constantă. Ieșirea din tema coral se probează pe ~3.000 de linii, nu pe ~7.400. |
| 2 | **Comenzi + Livrări** | Cele mai folosite, clar (57 % din vizualizări). Împart `UnifiedOrderCard` și `EditOrderSheet`; nu pot fi refăcute separat. Cel mai mare câștig, cel mai mare risc. |
| 3 | **Dashboard** | Al 3-lea ca folosire și singurul deschis de toți tenanții reali. Doar citire, fără formulare. |
| 4 | **Clienți + Culegători** | Liste gemene, formulare mici. Pagini rar deschise; formularul de client se deschide și din Comenzi. |
| 5 | **Cheltuieli + Investiții + Vânzări** | Cheltuieli și Investiții sunt aproape identice ca structură. Vânzări e doar registru. Nicio vizualizare în 90 de zile. |
| 6 | **Parcele + Activități** | Cel mai mare fișier din aplicație (3.291 linii); se face când kit-ul e rodat. Folosire rară. |
| 7 | **Stocuri + Produse + Magazin** | Magazinul public are brand propriu și tokeni separați. |
| 8 | **Rapoarte + Setări + Admin** | Folosire rară, în mare parte desktop. |
| mai târziu | **Asociație** (`/asociatie/*`), **desktopul**, **chat-ul AI** | În afara revamp-ului acum (decizii 18.11.2026). |

Față de ipoteza de pornire: Recoltări rămâne pilot înaintea perechii Comenzi + Livrări, Dashboard urcă pe 3, Asociație iese din ordine, iar pasul 0 e separat. Detalii în secțiunea 4.

---

## 1. Probleme care țin de toată aplicația

### 1.1 Straturi: ce e randat în pagină iese sub bara de jos — blocant

**Cauza.** `AppShell.tsx:26` pune conținutul paginii într-un `div` cu `relative z-10`. Asta creează un context de stivuire: tot ce e `fixed` înăuntru e pictat la nivelul 10 față de restul aplicației. `BottomTabBar` (`zIndex: 50`, `BottomTabBar.tsx:77`) și `UnifiedMobileFab` (`zIndex: 42`, `UnifiedMobileFab.tsx:47`) sunt frați cu `<main>` în `(dashboard)/layout.tsx:90-91`, deci în afara acelui context. Un z-index de 1100 pus în pagină pierde în fața barei de 50.

Dialogurile Radix (`ui/dialog.tsx:88`, `ui/sheet.tsx:49`, `ui/alert-dialog.tsx`) scapă fiindcă folosesc portal. Material săditor a rezolvat local cu `createPortal` (`VanzariButasiPageClient.tsx:279`).

**Locuri afectate azi** (toate `fixed` din dashboard și componente comune: 27 de apariții, Anexa C):

| Loc | Ce se întâmplă |
|---|---|
| `comenzi/ComenziSpeedDial.tsx:26,31,57` | Fundalul (`z-[41]`), acțiunile (`z-[44]`) și butonul de închidere (`z-[45]`) sunt montate în conținutul paginii (`ComenziPageClient.tsx:2747`). Fundalul nu acoperă bara de jos, iar butonul stă pe aceeași poziție cu FAB-ul global. |
| `association/livrari/AssociationLivrariClient.tsx:534` | Bara „Livrate x / y” e `fixed bottom-0 z-20`, exact unde stă bara de jos. Pe mobil ar trebui să fie acoperită complet. De confirmat pe telefon. |
| `comenzi/EditOrderSheet.tsx:387`, `settings/echipa/EchipaClient.tsx:453`, `notifications/NotificationBell.tsx:158`, `association/AssociationContextSwitcher.tsx:118` | Meniuri `absolute` fără portal; pot fi tăiate de containerul cu scroll sau acoperite. |
| `activitati-agricole/ConfirmDeleteActivitateDialog.tsx:29` | `fixed`, `zIndex: 1100`, fără portal. Fișierul nu mai e folosit (pagina folosește `window.confirm`, `page.tsx:661`). |

**Alte probleme de straturi**
- 27 de valori diferite de z-index, de la 0 la 1200 (78 de clase `z-*` în 50 de fișiere + 6 `zIndex` inline). Nu există o scară.
- Foaia din Material săditor își blochează singură scroll-ul (`document.body.style.overflow`) și nu anunță `modal-layer.ts`, deci FAB-ul nu se ascunde prin regula din `globals.css:348`. Nu are nici capcană de focus.
- `mobile/StickyActionButton.tsx:12` folosește `bottom-20` fix în loc de `--app-nav-clearance` (nefolosit nicăieri).
- Spațiul pentru bara de jos se calculează în 5 feluri: `--app-nav-clearance` (5 apariții), `--tabbar-h` (5), `--safe-b` (4), `env(safe-area-inset-bottom)` (33) și clase fixe `bottom-20`/`pb-28` (9).

### 1.2 `dark:` urmează telefonul, nu aplicația — mare

**Cauza.** `globals.css:1` importă Tailwind 4, dar nu există `@custom-variant dark` și nici `@config` (0 rezultate în tot repo-ul). În Tailwind 4, fără ele, `dark:` înseamnă `@media (prefers-color-scheme: dark)`. `tailwind.config.ts:4` are `darkMode: 'class'`, dar fișierul nu e încărcat de nimeni. `next-themes` pune corect clasa `.dark` pe `<html>` (`ThemeProvider.tsx:8`, `attribute="class"`, `defaultTheme="system"`), iar tokenii din `.dark { … }` (`globals.css:135`, `theme.css:109`) o ascultă.

**Efect.** Cât timp tema e pe „sistem”, cele două coincid. Când utilizatorul alege explicit o temă diferită de a telefonului, se despart: tokenii urmează aplicația, clasele `dark:` urmează telefonul. Cazul vizibil: telefon pe luminos, aplicație pe întunecat → `bg-white` rămâne alb pe fundal închis.

**Mărime.** 209 apariții în 25 de fișiere: dashboard 71 / 8 fișiere, admin 20 / 2, comun 34 / 9, public 83 / 5.

| Exemplu | Ce face |
|---|---|
| `parcele/ParcelePageClient.tsx:2427` | `bg-white … dark:bg-[var(--agri-surface)]` (38 de `dark:` în fișier) |
| `activitati-agricole/ActivityDetailDialog.tsx:121` | `bg-orange-100 … dark:bg-orange-900/30` |
| `app/BottomTabBar.tsx:67` | `dark:bg-[var(--agri-surface)]` (inutil, e același token) |
| `ui/button.tsx` (3), `ui/badge.tsx` (2) | variante `dark:` în primitive |
| `shop/FarmShopClient.tsx` | 40 de apariții (zona publică) |

Separat, `bg-white` fără pereche `dark:` rămâne alb în orice temă: `parcele/ParcelePageClient.tsx:1531`, `:2614`; `parcele/MicroclimatAutoCard.tsx:21,37,48`; `association/livrari/AssociationLivrariClient.tsx:262`.

**Reparația** e o linie în `globals.css`: `@custom-variant dark (&:where(.dark, .dark *));`. După ea, cele 209 apariții trebuie trecute o dată în revistă (multe devin corecte automat).

### 1.3 Temă separată, doar de zi, pentru Comenzi / Livrări / Recoltări — mare

`src/styles/zmeurel-orders.module.css` definește clasa `.theme` cu 111 tokeni; 95 au același nume ca tokenii globali și îi suprascriu (paletă coral + „charade”), 16 sunt nume noi (`--brand-coral-deep`, `--success-solid`, `--surface-input` …). Fișierul nu are nicio regulă `.dark`.

Aplicată în: `ComenziPageClient.tsx:1159,2446,2469`, `LivrariPageClient.tsx:381,412`, `RecoltariPageClient.tsx:721`, `comenzi/EditOrderSheet.tsx:578,595`.

Urmări:
- În modul noapte, cele trei module din bara de jos rămân luminoase, cu antetul și bara de jos închise la culoare. De confirmat pe telefon.
- Un dialog deschis în portal iese din `.theme`, dacă nu o re-aplică singur (`EditOrderSheet` o face; `AlertDialog`-urile din `UnifiedOrderCard` și `LivrariPageClient` nu au fost găsite făcând asta).
- Aceleași nume de tokeni înseamnă culori diferite în funcție de pagină, deci o componentă de kit arată diferit în Comenzi față de Cheltuieli fără ca nimeni să fi cerut asta.

Decizia e a voastră (întrebarea 1 din final): coralul rămâne ca accent al zonei de comenzi sau dispare.

### 1.4 Tokeni: ~12 familii în paralel — mare

Promptul vorbea de trei familii. În cod sunt mai multe. Definiții: `globals.css` (`:root` l.4, `.dark` l.135) și `theme.css` (`:root` l.1, `.dark` l.109); 210 nume distincte în cele două fișiere.

| Familie | Definită în | Utilizări `var(--…)` | Fișiere | Observații |
|---|---|---|---|---|
| `--agri-*` | globals + theme (25 nume) | 1.406 | 121 | Majoritatea sunt deja aliasuri: `--agri-surface: var(--surface-card)`, `--agri-text: var(--text-primary)` |
| `--text-*` | theme (5) | 1.046 | 90 | |
| `--surface-*` | theme (8) | 443 | 88 | |
| `--status-*` | theme (aliasuri) + globals | 547 | 71 | `--status-success-bg: var(--success-bg)` etc. |
| `--border-*` | theme | 229 | 62 | |
| `--soft-*` | globals (12) | 147 | 23 | Aceleași roluri ca `--success-*` / `--status-*`, valori diferite |
| `--success/warning/danger/info/neutral-*` | theme | 229 | 19+4+17+9+4 | |
| shadcn (`--primary`, `--card`, `--muted` …) | globals | 137 `var()` + 130 clase (`bg-muted` etc.) | 21 + 21 | Admin îl folosește în ecranele de analytics (35 de clase în 2 fișiere) |
| `--shadow-*` | theme | 108 | 45 | |
| `--brand-*`, `--pill-*`, `--button-*`, `--cta-*`, `--badge-*`, `--indicator-*`, `--value-*`, `--ai-*` | globals + theme | 93, 78, 41, 17, 6, 1, 15, 34 | | Tokeni pe componentă, nu pe rol |
| `.theme` (comenzi) | `zmeurel-orders.module.css` | — | 4 | Vezi 1.3 |
| `--gusta-*`, `--assoc-*` | `gusta-brand.css`, `association-shop.css` | 30, 9 | | Magazinul public; izolat |
| `src/lib/design-tokens.ts` (JS) | 62 linii | 151 (`colors.` / `radius.` / `shadows.` / `spacing.`) | 10 | Al patrulea loc cu valori |

**Suprapuneri (același rol, nume diferite)**

| Rol | Nume care coexistă |
|---|---|
| Fundal card | `--surface-card`, `--agri-surface`, `--card`, `--bg-card`, `--surface-elevated` |
| Fundal estompat | `--surface-card-muted`, `--agri-surface-muted`, `--muted`, `--secondary` |
| Text principal | `--text-primary`, `--agri-text`, `--foreground` |
| Text secundar | `--text-secondary`, `--agri-text-muted` (#3d4a41, altă valoare), `--muted-foreground` |
| Contur | `--border-default`, `--border-strong`, `--agri-border`, `--border`, `--border-color`, `--input-border`, `--card-border-default` |
| Principal | `--primary`, `--agri-primary`, `--accent-green`, `--pill-active-bg`, `--focus-ring`, `--ring` (toate #3D7A5F) |
| Pericol (text) | `--danger-text` #dc2626, `--soft-danger-text` #b91c1c, `--status-danger-text`, `--agri-danger` #c63b3b, `--destructive`, `--value-negative` |
| Info (text) | `--info-text` #2563eb, `--soft-info-text` #1d4ed8, `--status-info-text` |
| Umbră | `--shadow-soft`, `--shadow-card-soft`, `--agri-shadow`, `--agri-elevated-shadow`, `--shadow-elevated`, `--shadow-card-raised` |

**Erori concrete**
- `--agri-bg` e definit de două ori cu valori diferite: `#f5f5f3` în `theme.css:77` și `var(--surface-page)` (alb) în `globals.css:100`. Câștigă a doua.
- 7 tokeni folosiți, nedefiniți nicăieri, fără valoare de rezervă (33 de utilizări):

| Token | Utilizări | Exemplu |
|---|---|---|
| `--text-muted` | 16 în 6 fișiere | `association/comenzi/AssociationComenziInlineClient.tsx:263` |
| `--shadow-sm` | 6 | `comenzi/ComenziDinMesajSheet.tsx:581` |
| `--shadow-md` | 5 | `association/settings/AssociationSettingsClient.tsx:186` |
| `--border-subtle` | 2 | `association/producatori/AssociationProducatoriClient.tsx:312` |
| `--surface-muted` | 2 | `recoltari/RecoltariPageClient.tsx:232` |
| `--shadow-glow` | 1 | `comenzi/ComenziSpeedDial.tsx:67` |
| `--success-surface` | 1 | `analytics-magazin/page.tsx:162` |

- 35 de tokeni definiți și nefolosiți (fără `--color-*` și `--radius-*`, pe care le consumă Tailwind), de exemplu `--fab-surface|border|text`, `--status-purple-*`, `--bg-primary|secondary|card`, `--input-bg|border|placeholder`, `--agri-primary-muted`, `--space-v`.
- `.dark` acoperă toți tokenii de culoare din `:root` (lipsesc doar dimensiuni și raze, corect).
- Butonul implicit folosește `--brand-blue`, nu culoarea principală (`ui/button.tsx:13`).

### 1.5 Culori puse direct în cod — mic în dashboard

| Ce | Total (fișiere / apariții) | dashboard | admin | comun | public | lib |
|---|---|---|---|---|---|---|
| Hex în `.ts/.tsx` | 97 / 727 | 13 / 65 | 0 | 1 / 10 | 78 / 590 | 5 / 62 |
| … din care în `className` (`[#…]`) | 56 / 425 | 2 / 18 | 0 | 1 / 10 | 53 / 397 | 0 |
| `rgb()/rgba()/hsl()` literale | 30 / 84 | 5 / 18 | 0 | 2 / 3 | 21 / 53 | 2 / 10 |
| Clase din paleta Tailwind (`bg-amber-100` …) | 49 / 476 | 13 / 78 | 4 / 55 | 4 / 40 | 24 / 265 | 4 / 38 |
| `bg/text/border-white|black` | 104 / 433 | 29 / 120 | 1 / 1 | 15 / 35 | 57 / 274 | 2 / 3 |
| `style={{` inline | 79 / 665 | 25 / 257 | 1 / 1 | 12 / 65 | 40 / 341 | 1 / 1 |

162 de valori hex distincte. Cele mai dese: `#312e3f` (84), `#3d7a5f` (49), `#f16b6b` (47) — toate au deja token.

Exemple din dashboard: `recoltari/RecoltariPageClient.tsx:213` (gradient hex), `vanzari-butasi/VanzariButasiPageClient.tsx:645,647` (`bg-[#1b3a2a]`, `text-[#b9d4c5]` — chiar în modulul de referință), `dashboard/page.tsx:755` (`text-amber-700`), `association/livrari/AssociationLivrariClient.tsx` (11 hex în `className`), `lib/supabase/queries/investitii.ts` (9 clase de paletă într-un fișier de interogări), `lib/notifications/config.ts` (12 hex).

Stiluri inline masive: `parcele/ParcelePageClient.tsx` (61), `ai/AiBottomSheet.tsx` (48), `app/MoreMenu.tsx` (35, fișier mort), `culegatori/CulegatorCard.tsx` (30, mort), `vanzari/VanzariPageClient.tsx` și `rapoarte/RapoartePageClient.tsx` (cifre și pastile).

### 1.6 Formulare vechi — mare

**`AppDrawer` nu e sertar.** `app/AppDrawer.tsx:40-54` și `app/AppDialog.tsx` randează amândouă `Dialog` + `FormDialogLayout`: o fereastră centrată (`ui/dialog.tsx:92`), lată `w-[min(96vw,720px)] … sm:max-w-lg` (`ui/form-dialog-layout.tsx:139`). Diferă doar proprietățile acceptate. Meniul „Mai mult” e tot un `AppDrawer` (`MoreMenuDrawer.tsx:203`). `AppDialog` e importat în 23 de fișiere, `AppDrawer` în 16.

**Tipare care se repetă**
- Toate câmpurile pe un ecran. Niciun formular în afară de Material săditor nu e pe pași (tabel complet în Anexa B).
- Formularul scris de două ori în același fișier, o dată pentru mobil și o dată pentru desktop: `cheltuieli/AddCheltuialaDialog.tsx:185` (`md:hidden`) și `:381` (`hidden md:block`); la fel în Investiții, Activități, Recoltări, Comenzi.
- Selectoare ascunse deschise prin `document.getElementById(…).click()` (`AddCheltuialaDialog.tsx:194`).
- Adăugarea și editarea aceluiași lucru arată diferit: la Recoltări, Add are plăcuțe pe mobil, Edit are `Select`; la Cheltuieli, suma e `type="text"` în Add (`:285`) și `type="number"` în Edit (`EditCheltuialaDialog.tsx:166`).
- O comandă are două formulare de editare: `EditOrderSheet` din card (`ComenziPageClient.tsx:2766`) și `ComandaDialog` din vizualizare (`:2846`).
- `ui/ResponsiveFormContainer.tsx:27-33` randează pe mobil formularul direct în pagină, fără fereastră (folosit la „Actualizează stadiu” în Parcele).
- Același câmp înregistrat de două ori: `activitati-agricole/ActivitateAgricolaForm.tsx:363` și `:436` (`register('observatii')`).
- Câmpuri în schemă care nu apar pe ecran: 22 în schema de teren, 15 etichete (`parcele/ParcelForm.tsx`); 7 în schema de activitate, 4 afișate.
- 17 `<select>` native în afara testelor, 15 în dashboard (Produse, Culegători, Stocuri, Asociație, Documente legale) lângă `AppSelect` și `ui/select`.
- Ștergere cu `window.confirm` în Activități (`page.tsx:661`).

### 1.7 Ținte de atingere sub 48 px — mare

**La sursă.** `ui/button.tsx:25-32`: `default` 40 px, `sm` 36, `lg` 44, `xs` 24, `icon` 40, `icon-sm` 36, `icon-xs` 28, `icon-lg` 40. Nicio variantă nu ajunge la 48. Câmpurile (`ui/input.tsx:6`, `ui/select.tsx:16`) au `--agri-field-h` = 44 px. Butonul de închidere al dialogului are 40 px (`ui/dialog.tsx`, `size-10`).

**Compensarea.** Clasa `.agri-control` (`globals.css:411`, `min-height: var(--touch-control-h)` = 48 px) e pusă manual de 156 de ori în 34 de fișiere. Variabila `--touch-control-h` nu e citită direct nicăieri altundeva.

| Ce | Fișiere / apariții |
|---|---|
| `<Button>` din kit | 68 / 277 |
| … cu mărime mică explicită (`sm`, `icon`, `icon-sm`, `icon-xs`) | 36 / 87 |
| `<button>` brute, cu mărimi scrise de mână | 103 / 356 |
| Clase `h-6 … h-11` / `size-6 … size-11` (include și iconițe) | 114 / 394 (`h-11` ×134, `h-10` ×73, `h-8` ×61, `h-9` ×60) |
| `h-[<48px]` arbitrare | 20 / 32 |
| Clase de 48 px sau mai mult (`h-12`, `h-14`, `min-h-12` …) | 72 / 200 |

Numărătoarea pe clase nu poate separa automat butoanele de iconițe; cifra sigură e cea de la sursă (variantele `Button`). Atribuirea exactă pe ecrane se face la mockupuri.

Exemple: `comenzi/ComenziPageClient.tsx:2552` (buton-iconiță `h-9 w-9`), `recoltari/RecoltariPageClient.tsx:795` (`h-9 w-9`), `comenzi/UnifiedOrderCard.tsx:547` (`h-8 w-8`), `cheltuieli/CheltuialaPageClient.tsx:259` (`min-h-8`, text 11 px), `produse/AddProdusDialog.tsx:319` (ștergere poză, `h-5 w-5`), `app/PageHeader.tsx:75` (`h-7`), `notifications/NotificationBell.tsx:138` (`h-9 w-9`), `rapoarte/RapoartePageClient.tsx:728` (pastilă cu `padding: 4px 14px`, font 12).

Și modulul de referință are ținte de 44 px: butoanele rotunde de închidere și segmentele folosesc `h-11` (`VanzariButasiPageClient.tsx:332,682`, `ComandaButasiWizard.tsx:314`).

### 1.8 Text sub 13 px — mare

| Ce | Total (fișiere / apariții) | dashboard | admin | comun | public |
|---|---|---|---|---|---|
| `text-xs` (12 px) | 146 / 666 | 84 / 490 | 4 / 39 | 19 / 27 | 38 / 109 |
| `text-[Npx]` cu N < 13 | 77 / 335 | 34 / 239 | 2 / 9 | 16 / 27 | 24 / 59 |
| … din care ≤ 10 px | 45 / 111 | 24 / 79 | 2 / 7 | 6 / 7 | 12 / 17 |
| `fontSize` inline < 13 | 13 / 94 | 9 / 81 | 0 | 4 / 13 | 0 |

Doar 9 dintre ele au prefix de desktop (`md:` / `lg:`), deci restul se aplică și pe telefon.

Ce mărimi se folosesc de fapt: `text-sm` (14 px) ×858, `text-xs` ×660, `text-base` ×209, `text-[11px]` ×159, `text-[10px]` ×108, `text-lg` ×104, `text-[13px]` ×71, `text-[12px]` ×62. Treptele din scara propusă apar rar și aproape numai în Material săditor: 15 px ×28, 22 ×14, 17 ×8, 26 ×4, 19 ×2.

Cele mai încărcate fișiere: `parcele/ParcelePageClient.tsx` (82), `comenzi/UnifiedOrderCard.tsx` (54), `dashboard/DashboardV2Sections.tsx` (41), `clienti/ClientPageClient.tsx` (28), `admin/analytics/AdminAnalyticsDashboardView.tsx` (26).

Exemple: `activitati-agricole/page.tsx:144,386,401` (10 px), `comenzi/ComenziPageClient.tsx:950` (10 px), `vanzari/VanzariPageClient.tsx:479` (`fontSize: 10`), `rapoarte/RapoartePageClient.tsx:752` (`fontSize: 11`).

### 1.9 Alte probleme transversale

| Problemă | Mărime | Gravitate |
|---|---|---|
| Fișiere uriașe: `parcele/ParcelePageClient.tsx` 3.291 linii, `comenzi/ComenziPageClient.tsx` 3.054 (cu formularul de comandă înăuntru, l. 970–1600), `dashboard/page.tsx` 1.768, `clienti/ClientPageClient.tsx` 1.741, `settings/page.tsx` 1.666, `comenzi/UnifiedOrderCard.tsx` 1.471 | 6 fișiere | mare |
| Raze: 13 valori arbitrare (`rounded-[22px]` ×25, `[18px]` ×23, `[16px]` ×13, `[20px]` ×11, `[14px]` ×10, `[24px]` ×9, `[28px]` ×8 …) peste clasele standard (`xl` ×362, `full` ×255, `2xl` ×251, `lg` ×124) | 62 fișiere / 136 arbitrare | mic |
| Umbre: 72 de umbre literale + `shadow-sm/md/lg` ×109 + 4 tokeni de umbră | 34 fișiere / 72 literale | mic |
| Emoji folosite ca iconițe, alături de `lucide-react` (bara de jos e pe emoji, `BottomTabBar.tsx:16-21`) | 98 fișiere / 568 emoji; 119 fișiere importă lucide | mic |
| Ramificare mobil/desktop în 4 feluri: clase `md:hidden`, `ResponsiveDataView` (9 fișiere), `DesktopSplitPane` (4 module), `useMediaQuery`/`matchMedia` (24 de fișiere) | | mic |
| Pagini fără `AppShell` și fără antet: `clienti-magazin/page.tsx` (tabel `min-w-[880px]`, l. 78), `analytics-magazin/page.tsx`. Ambele apar doar în meniul de desktop. `/planuri` nu e legată din niciun meniu. | 3 rute | mic |
| Chat-ul AI nu are buton de deschidere: `openAiPanel` e definit în `contexts/AiPanelContext.tsx:20` și nu e apelat nicăieri; `AiPanel` e și el `hidden md:block`. | | de clarificat |
| Texte: „unit_label”, „approximate_weight” ca etichete (`produse/AddProdusDialog.tsx:229,260`); „Edit” / „Delete” (`activitati-agricole/page.tsx:654,665`); „Nu exist? tenanți” (`admin/AdminTenantsPlanTable.tsx:209`) | | mic |
| Documentația nu mai corespunde codului: `CLAUDE.md` pomenește `src/app/admin` (nu există) și `ActivitatiAgricolePageClient.tsx` (șters) | | mic |

---

## 2. Componente duplicate

Coloana „importuri” = câte fișiere importă componenta (Anexa F, comanda 9).

| Familie | Implementări (importuri) | Cea mai bună bază | Ce s-ar consolida |
|---|---|---|---|
| Card de listă | `ui/MobileEntityCard` (9), `ui/app-card` (12), `ui/card` (13), `ui/CompactFinanceListCard` (2), `app/CompactListCard` (1), `app/BaseCard` (1), `ui/MiniCard` (0); locale: `ButasiOrderCard`, `UnifiedOrderCard` (1.471 linii), `ClientCardNew`, `CulegatorCardNew`, `TerenCard` | `ButasiOrderCard` (`VanzariButasiPageClient.tsx:131`) | Un card de kit cu zone fixe (titlu, detalii, sumă, pastile, acțiune principală). `ui/card` rămâne pentru admin și desktop. |
| Cifre (KPI) | `app/KpiCard` (1), `app/DesktopKpiStrip` (1), `ModuleScoreboard` din `module-list-chrome` (11); locale: `KpiCard` în `AssociationDashboardClient.tsx:43`, `KpiStat` (admin), `StatCard` (`analytics-magazin/page.tsx:70`), `KpiSummaryWidget`, cifrele inline din Material săditor | Cifrele din `VanzariButasiPageClient.tsx:645-659` | `StatTile` unic; `ModuleScoreboard` devine un rând de `StatTile`. |
| Pastilă de status | `ui/StatusBadge` (11), `ui/badge` (12), `app/StatusChip` (0), `ui/TrendBadge` (1), `app/SyncBadge` (1), `lib/ui/status-badges` (2), `StatusPill` în `UnifiedOrderCard.tsx:168`, `statusInfo` în Material săditor | `statusInfo` (`VanzariButasiPageClient.tsx:121`) ca aspect, `StatusBadge` ca API | O pastilă cu 5 tonuri; restul dispar. |
| Stare goală | `ui/EmptyState` (1), `app/EmptyState` (1), `app/EmptyStateBase` (2), `ModuleEmptyCard` (în 11), plus cele scrise inline | `ModuleEmptyCard` ca răspândire | Una singură în kit. |
| Fereastră / foaie | `app/AppDialog` (23), `app/AppDrawer` (16), `ui/dialog` (22), `ui/sheet` (12), `ui/alert-dialog` (13), `ui/form-dialog-layout` (26), `ui/ResponsiveFormContainer` (1), `app/ConfirmDeleteDialog` (1) + `parcele/DeleteConfirmDialog` (folosit din 3 alte module), `BottomSheet` local în Material săditor | `ui/sheet` (Radix: portal, focus, Esc) cu aspectul foii din Material săditor | `AppDrawer` + `AppDialog` → una singură. O foaie de jos de kit. O confirmare de ștergere. |
| Bară de acțiune / FAB | `app/StickyActionBar` (2), `mobile/StickyActionButton` (0), `ui/UnifiedMobileFab` (1), `ComenziSpeedDial`, `app/QuickActionsPanel` (0) | `UnifiedMobileFab` + footerul din wizard | Un singur mecanism de acțiune principală pe pagină. |
| Filtre | `ModulePillRow` / `ModulePillFilterButton` (11), `ComenziSectionPills`, `PillTabs` (`ComenziPageClient.tsx:688`), pastile inline în Vânzări, Rapoarte, Produse; segmentele din Material săditor | Segmentele și pastilele din `VanzariButasiPageClient.tsx:667-740` | `Segmente` + `FiltrePastila` în kit. |
| Câmpuri | `ui/select` (11) vs `ui/app-select` (17) vs `<select>` nativ (17 locuri); `ui/app-date-picker` (21) vs `<input type="date">` vs calendarul din wizard; `app/NumericField` (3) vs pasul cu săgeți din wizard; `ui/form` (0 importuri) | `app-select`, calendarul și numărul din wizard | Un selector, un calendar, un câmp numeric. |
| Antet | `app/PageHeader` (32), `layout/CompactPageHeader` (1), `app/TopBar` (0), antet scris de mână în Livrări | `PageHeader` | Rămâne, cu ținte de 48 px. |
| Schelete | `app/ListSkeleton` (28), `app/ModuleSkeletons` (12), `ui/skeleton` (12), `app/FormSkeleton` (2), `app/DialogInitialDataSkeleton` (4), `app/LoadingState` (3) | `ListSkeleton` | Se păstrează; se aliniază la forma noilor carduri. |

**Cod nefolosit.** 36 de fișiere `.tsx` din `src/components` nu sunt referite de niciun alt fișier în afara testelor (6.475 de linii, Anexa E). Trei sunt chiar în modulul de referință: `VanzareButasiCard.tsx` (439), `ViewVanzareButasiDialog.tsx` (251), `VanzareButasiFormSummary.tsx` (97). Lista e de candidați: verificarea e pe nume, nu a fost rulat un build fără ele.

---

## 3. Propunerea de kit (Faza 1)

### 3.1 Valori — confirmări și ajustări

| Element | Propus de voi | Ce am găsit | Recomandare |
|---|---|---|---|
| Scara de text | 26 / 22 / 19 / 17 / 15 / 13 | Material săditor folosește exact aceste trepte, plus `12.5px` (×3), `text-xs` la supratitlu, `text-sm`, `text-base`, `text-lg` și `64px` la cantitate | **Confirm**, cu trei reguli: (a) câmpurile de introducere au minimum 16 px (folosim 17), altfel Safari pe iPhone mărește pagina la focus; (b) 13 px e doar pentru text ajutător, niciodată pe ceva apăsabil; (c) o treaptă separată de „cifră mare” (64) pentru câmpul numeric. `12.5px` → 13. |
| Spațiere | pași de 4 | Referința folosește și `p-3.5` (14), `gap-1.5` (6), `gap-0.5` (2); 32 de spațieri arbitrare în tot codul | **Confirm.** 14 → 12 sau 16. Se permite 2 px doar între o cifră și eticheta ei. |
| Colțuri | 12 / 16 / 22 / 28 | Referința: 16 (`rounded-2xl`, dominant), 12, `[22px]` card, `[28px]` foaie, plus `[18px]` la cifre și `[10px]` la pastile | **Confirm**, plus `full`. 18 → 16, 10 și 14 → 12, 20 → 22, 24 și 26 → 28. `rounded-lg` (8 px, ×124) rămâne doar pentru elemente mici din interior (bife, bare). |
| Umbre | două niveluri | Există deja `--shadow-soft` (×86) și `--shadow-elevated`; foaia de jos are o a treia umbră, literală, în sus | **Două niveluri + una de suprapunere** (foi și dialoguri). Fără a treia, foaia rămâne cu umbră scrisă de mână. |
| Atingere | min. 48, principal 56 | Referința: 56 la butonul principal, 48 la înapoi/închide din wizard, dar 44 la închiderea foilor și la segmente | **Confirm.** Cele de 44 din referință urcă la 48. Kit-ul citește `--touch-control-h` / `--touch-control-h-lg`, care există deja și sunt legate de densitate și de modul „vizibilitate ridicată” (`globals.css:461,470`). Densitatea compactă (44) ar trebui limitată la desktop. |
| Tokeni | un set pe roluri, `.dark` pe clasă | Vezi 1.4 | **Confirm.** Propunere de nume mai jos. |
| Straturi | — | 27 de valori | **Adaug** o scară: navigare 50, FAB 60, fundal 1000, foaie/dialog 1010, listă derulantă 1020, notificare 1030. |

**Set de tokeni propus** (definiți o dată în `:root` și `.dark`, expuși în `@theme inline` ca să existe clase scurte de tipul `bg-surface`, `text-muted`, în locul celor ~4.000 de `[var(--…)]`):

| Rol | Tokeni |
|---|---|
| Principal | `primary`, `primary-contrast`, `primary-soft` |
| Suprafață | `page`, `surface`, `surface-muted`, `surface-raised` |
| Text | `text`, `text-muted`, `text-subtle` |
| Contur | `border`, `border-strong` |
| Stări | `info`, `success`, `warning`, `danger`, fiecare cu `-bg`, `-text`, `-border` |
| Formă | raze 12/16/22/28, umbre 1/2/suprapunere, atingere 48/56, straturi |

Numele finale se stabilesc în Faza 1, fiindcă `--primary` și `--border` există deja în setul shadcn și trebuie preluate, nu dublate.

### 3.2 Componente de extras din Material săditor

Destinație propusă: `src/components/kit/`. Excepție: butonul, care ar trebui să extindă `ui/button.tsx` (69 de importuri) cu două mărimi noi, nu să apară ca al doilea buton.

| Componentă | Sursă | Ce trebuie generalizat |
|---|---|---|
| Buton mare (principal / secundar / pericol) | `ComandaButasiWizard.tsx:1494-1501`, `:768,775`; `VanzariButasiPageClient.tsx:243,346,354` | Azi sunt șiruri de clase copiate. Variante, mărimi 48 și 56, stare de încărcare, iconiță. În `ui/button.tsx` ca mărimi noi; mărimea implicită se schimbă abia la final. |
| `Tile` (+ subtitlu) | `ComandaButasiWizard.tsx:223-257` | Alegere unică sau multiplă, rol `radio` / `checkbox`, număr de coloane, iconiță. |
| Segmente | `VanzariButasiPageClient.tsx:665-690` | Orice număr de opțiuni, 48 px, roluri ARIA. Înlocuiește `ComenziSectionPills`, `PillTabs`. |
| Filtre pastilă | `VanzariButasiPageClient.tsx:~725-740` | Derulare orizontală, contor opțional. Înlocuiește `ModulePillRow`. |
| `StatTile` | `VanzariButasiPageClient.tsx:645-659` | Nu e componentă azi, e JSX repetat. Valoare, etichetă, ton (neutru / atenție / inversat). Culorile hex de la l. 645-647 trec pe tokeni. |
| `BottomSheet` în portal | `VanzariButasiPageClient.tsx:256-298` | **Nu aș generaliza varianta cu `createPortal`.** Îi lipsesc capcana de focus, legătura cu `modal-layer` (ascunderea FAB-ului) și cu butonul „înapoi” de pe Android (`lib/ui/dialog-history.ts`). Aș construi foaia de kit peste `ui/sheet.tsx` (Radix), cu aspectul de aici: mâner, colțuri 28, umbră de suprapunere. |
| Formular pe pași (antet de progres + footer) | carcasa `ComandaButasiWizard.tsx:1444-1506`; logica de pași `:511-534` | Carcasă separată de conținut: antet (înapoi, „Pasul x din y”, închide, bară), zonă cu scroll, footer cu butonul principal. Pașii ca listă de configurare. Întoarcerea din recapitulare, resetarea la deschidere, evenimentele de analytics și cheia de idempotență trebuie să fie în carcasă, nu rescrise în fiecare modul. |
| Calendar în foaie | `CalendarPanel`, `ComandaButasiWizard.tsx:278-403` | Limite min/max, scurtături (Azi / Mâine), limba. `ui/app-date-picker.tsx` rămâne pentru desktop. |
| Număr cu săgeți | cantitate `:1070-1130`, preț `:1140-1170` | Pași configurabili (±1, ±5, ±10), zecimale (kg), unitate, limite. Două mărimi: mare (ecran dedicat) și compactă (în rând). |
| Card cu acțiune principală | `ButasiOrderCard`, `VanzariButasiPageClient.tsx:131-252` | Zone (titlu, detalii, sumă, pastile, subsol) + un singur buton principal. E legat acum de tipul comenzii de butași. |
| Pastilă de status | `statusInfo`, `VanzariButasiPageClient.tsx:121-127` | Tonuri pe roluri în loc de nume de status. |
| Stare goală | `VanzariButasiPageClient.tsx:765-775` | Iconiță, titlu, text, acțiune opțională. |
| Câmp text mare | `inputBase`, `ComandaButasiWizard.tsx:270-272` | 56 px, 17–18 px text; variantă pentru `ui/input.tsx`. |
| Rând de alegere din listă | `ComandaButasiWizard.tsx:945-960` | Avatar cu inițială, titlu, detaliu, săgeată. |
| Rând de recapitulare cu „Schimbă” | `ComandaButasiWizard.tsx:1296-1308` | Etichetă, valoare, sumă, acțiune. |
| Ecran de reușită | `ComandaButasiWizard.tsx:752-780` | Titlu, text, două butoane. |

De curățat înainte de extragere: cele 3 fișiere nefolosite din `components/vanzari-butasi/` și amestecul de familii de tokeni din referință (folosește `--agri-*`, `--text-*`, `--surface-*`, `--soft-*`, `--status-*` și `--success-text` în același fișier).

### 3.3 Migrarea tokenilor fără să stricăm modulele nerefăcute

1. **Varianta dark pe clasă.** O linie în `globals.css`. Apoi se verifică cele 209 `dark:`.
2. **Straturile.** Se scoate `z-10` de pe conținutul din `AppShell` (sau se mută toate suprapunerile în portal) și se introduce scara de straturi.
3. **Setul nou**, definit o singură dată pentru zi și noapte.
4. **Numele vechi devin aliasuri** către cele noi (`--agri-text: var(--text)` etc.). Mecanismul există deja pentru jumătate din `--agri-*`, deci modulele nerefăcute nu se schimbă vizual. Unde seturile paralele au valori diferite (de exemplu `--danger-text` și `--soft-danger-text`) se alege o valoare după contrast și se acceptă o diferență mică de nuanță.
5. **Cei 7 tokeni lipsă** primesc alias imediat (e reparație de eroare, nu redesign).
6. **Tema coral** (1.3) devine fie un accent cu valori și pentru noapte, aplicat cu un atribut pe zonă, fie dispare. Depinde de răspunsul vostru.
7. **La fiecare modul refăcut** se înlocuiesc numele vechi. O verificare automată (regulă de lint sau un `git grep` în CI) interzice `--agri-`, hex, `dark:` și `text-[1Xpx]` sub 13 în folderele deja migrate.
8. **Retragere.** Un alias se șterge când numărul lui de utilizări ajunge la 0. `lib/design-tokens.ts` pleacă odată cu fișierele nefolosite care îl importă.

---

## 4. Ordinea modulelor — argumente

Criterii: cât de des e folosit (din cod și, din Faza 0b, din analytics), cât de mare e, cât de riscant.

**Frecvență din cod.** Bara de jos are, în ordine: Acasă, Livrări, Recoltări, Comenzi (`BottomTabBar.tsx:16-21`). Antetul de desktop are scurtături spre Comenzi, Livrări, Recoltări, Clienți. Restul stau în „Mai mult”.

**Frecvență reală (analytics, 20.08–18.11.2026).** Din `page_view` (Anexa G, interogarea B): **404 evenimente** în 90 de zile, de la **5 tenanți reali** (402) și 1 demo (2). Colectarea `page_view` există din 15.03.2026, deci fereastra de 90 de zile e acoperită integral. Volumul e mic și concentrat: un singur tenant are 360 din 402 vizualizări. Cifrele arată o **tendință**, nu o măsurătoare.

| Modul | Vizualizări (tenanți reali) | Zile active (însumate pe tenanți) | Tenanți care l-au deschis (din 5) |
|---|---:|---:|---:|
| Comenzi | 137 | 35 | 3 |
| Livrări | 93 | 23 | 3 |
| Dashboard | 68 | 31 | 5 |
| Recoltări | 54 | 18 | 3 |
| Material săditor (referința) | 38 | 2 | 1 |
| Parcele | 3 | 2 | 2 |
| Rapoarte | 3 | 2 | 2 |
| Activități | 2 | 2 | 2 |
| Clienți, Culegători, Notificări, Admin | câte 1 | câte 1 | câte 1 |
| Cheltuieli, Investiții, Vânzări, Stocuri, Produse, Setări, Asociație, Clienți magazin, Analytics magazin | 0 | 0 | 0 |

Ce se vede clar, chiar la volum mic: Comenzi + Livrări fac 57 % din vizualizări și au cea mai constantă folosire (tenantul principal le-a deschis în 32, respectiv 20 de zile distincte); Dashboard e singurul deschis de toți; Recoltări e folosit constant (15 zile la tenantul principal); restul modulelor sunt aproape nedeschise. Material săditor are un vârf de 38 de vizualizări în 2 zile, nu folosire constantă. `view_module` (interogarea A) confirmă ce se suprapune: Recoltări 51, Parcele 3, Activități 2.

Limite: `page_view` se trimite doar din zona de dashboard, cu utilizator autentificat și tenant — rutele publice nu apar deloc, ceea ce nu înseamnă că nu sunt folosite. Formularele deschise dintr-un alt modul (de ex. clientul din Comenzi) nu apar ca vizualizări ale modulului lor.

| Modul | Linii (rută + componente) | Formulare | Teste care îl ating | Note de risc |
|---|---|---|---|---|
| Recoltări | 1.093 + 1.859 | 2 (7 câmpuri) | e2e: `/recoltari` ×7 (smoke, offline, idempotency, stocuri) | scrie în stoc; tema coral |
| Comenzi | 4.632 + 2.765 | 5 (până la 9 câmpuri) | 4 fișiere de teste de componentă (1.825 linii); niciun e2e | cel mai mare; două formulare de editare; speed dial; „din mesaj” |
| Livrări | 861 + 0 | 1 confirmare | 1 test de componentă | reordonare prin tragere; depinde de componentele din Comenzi |
| Clienți | 1.812 + 1.159 | 2 (8 câmpuri) | — | import de contacte; 5 fișiere nefolosite |
| Culegători | 927 + 716 | 2 (7 câmpuri) | — | simplu |
| Asociație | 328 + 5.943 | 22 de ferestre și foi în 7 fișiere | e2e: produse ×2 | folosit în producție de asociație; bara din Livrări (1.1) |
| Dashboard | 1.808 + 2.083 | 0 | e2e: `/dashboard` ×13 (mai ales ca punct de intrare) | grilă editabilă pe desktop |
| Cheltuieli | 1.050 + 754 | 2 (5 câmpuri) | 1 test de componentă; e2e ×1 | formular dublat mobil/desktop |
| Investiții | 722 + 894 | 2 (6 câmpuri) | 1 test de componentă | geamăn cu Cheltuieli |
| Vânzări | 614 + 168 | 0 | e2e ×2 | doar registru |
| Parcele | 42 + 7.409 | 6 (până la 14 câmpuri) | e2e ×2–3; 2 teste de componentă | cel mai mare fișier; 38 `dark:`; 6 fișiere nefolosite |
| Activități | 715 + 1.619 | 2 (4 câmpuri) | e2e ×1 | formularul e folosit și din Parcele |
| Stocuri | 246 + 176 | 1 (4 câmpuri) | e2e ×1 | mic |
| Produse | 794 + 1.072 | 3 (8–9 câmpuri) | — | poze; ofertă către asociație |
| Rapoarte | 1.047 | 0 | e2e ×5 | export; stiluri inline |
| Setări | 2.546 + 685 | 7 dialoguri + 2 pagini | e2e ×3 | ștergere cont, resetare fermă |
| Admin | 329 + 1.700 | 0 | e2e ×3 | doar superadmin; pe setul shadcn |

**Ordinea revizuită** (detaliată în Rezumat): fundația → Recoltări (pilot) → Comenzi + Livrări → Dashboard → Clienți + Culegători → Cheltuieli + Investiții + Vânzări → Parcele + Activități → Stocuri + Produse + Magazin → Rapoarte + Setări + Admin. Asociația, desktopul și chat-ul AI sunt „mai târziu” (decizii din secțiunea 6).

**Recoltări rămâne pilot.** Datele confirmă ipoteza voastră: Comenzi + Livrări sunt cele mai folosite, cu diferență clară. Dar argumentul pentru pilot nu era frecvența, ci riscul, iar el nu se schimbă: Recoltări are un singur formular, care se potrivește natural pe pași (parcelă → culegător → kilograme → verificare); e singurul modul operațional cu acoperire e2e reală, deci o regresie se vede; și e folosit constant, deci un pilot pe el chiar e văzut în teren. Cu decizia ca tema coral să dispară, Recoltări probează ieșirea din ea pe ~3.000 de linii înainte de cele ~7.400 din Comenzi + Livrări. Datele întăresc doar o condiție: Comenzi + Livrări vin imediat după pilot, fără alt modul la mijloc. Dacă preferați impactul imediat, ordinea 1 ↔ 2 se poate inversa fără alte consecințe.

**De ce Dashboard urcă pe 3.** E al treilea ca vizualizări și singurul deschis de toți tenanții reali, pe când Clienți și Culegători au câte o singură vizualizare în 90 de zile. Diferența e clară, iar Dashboard nu are formulare, deci e ieftin odată ce kit-ul există. Asociația a ieșit din ordine prin decizie, nu din date (oricum nu apare în `page_view` pe perioada analizată).

**De ce Comenzi + Livrări împreună.** Livrări nu are componente proprii: importă `UnifiedOrderCard`, `PaymentStatusToggle` și `EditOrderSheet` din Comenzi. Refăcute separat, una dintre ele ar rămâne o vreme pe jumătate veche.

**De ce Parcele târziu.** E cel mai mare și cel mai dens fișier, cu cele mai multe probleme pe linie, dar e folosit mai rar decât fluxurile zilnice și are nevoie de aproape toate componentele kit-ului (foaie cu file, formular lung, carduri, jurnal).

---

## 5. Riscuri pentru revamp

| Risc | Unde | Ce înseamnă |
|---|---|---|
| Teste e2e legate de structura formularelor | `e2e/smoke.spec.ts`, `offline.spec.ts`, `idempotency.spec.ts`, `stocuri.spec.ts`: `#parcela_id`, `#culegator_id`, `#cantitate_kg`, `#data`, `button[type="submit"]`, `/^Salveaza$/` | Un formular pe pași le rupe pe toate la Recoltări. Unele caută text fără diacritice („Salveaza”, „Recoltare adaugata”), deci s-ar putea să pice deja; nu le-am rulat. Doar 21 de `data-testid` în tot `src/`. |
| CI nu rulează e2e de dashboard | `.github/workflows/check.yml` rulează `check:critical`; doar checkout-ul are e2e în CI | Regresiile de UI nu sunt prinse automat. |
| Teste de componentă legate de markup | `comenzi/__tests__` (4 fișiere), `LivrariPageClient.test.tsx`, `AddCheltuialaDialog.test.tsx`, `AddInvestitieDialog.test.tsx` | Se rescriu odată cu modulul. |
| Idempotență la creare | `client_sync_id` / `generateClientId` apar în UI doar în Cheltuieli și Activități (4 fișiere) | Cheia trebuie generată o dată pe deschiderea formularului, nu la fiecare apăsare pe „Salvează”. Într-un formular pe pași e ușor de greșit. De verificat și de ce celelalte formulare de creare nu o au. |
| Evenimentele de formular | `open_create_form` → `create_success` / `form_abandoned` în 5 formulare; citite de `lib/admin/analytics-dashboard-data.ts` | Carcasa de formular pe pași trebuie să le emită, altfel pâlnia din admin se golește. |
| Precompletare din adresă | 7 pagini de modul citesc `useSearchParams` (Cheltuieli, Recoltări, Activități, Comenzi, Clienți, Investiții, Parcele) | Formularele noi trebuie să accepte aceleași valori inițiale. |
| Butonul „înapoi” pe Android | `lib/ui/dialog-history.ts`, proprietatea `disableHistory` din `Dialog` | Foaia nouă trebuie să se închidă la „înapoi”, nu să schimbe pagina. Foaia din Material săditor nu e legată de mecanism. |
| Ascunderea FAB-ului sub ferestre | `ui/modal-layer.ts` + `globals.css:348` | Orice suprapunere scrisă de mână o ocolește. |
| Densitate și vizibilitate ridicată | `globals.css:450-512` schimbă `--touch-control-h` și mărimea textului | Kit-ul trebuie să citească variabilele, nu să fixeze pixeli. |
| Stocul derivat | Recoltări, Comenzi, Livrări | Refacerea e doar de interfață; datele trimise la salvare nu trebuie atinse. |
| Tragere și reordonare | `@dnd-kit` în Livrări și Asociație, grila editabilă din Dashboard | Sensibile la schimbări de structură și de straturi. |
| Actualizare automată a aplicației instalate | service worker cu `skipWaiting` (commit `cde014f`) | Fiecare livrare ajunge imediat la toți. Nu există comutator pe modul; merită unul pentru primele module. |
| Desktop | `DesktopSplitPane` / inspector / toolbar în 4 module; `docs/ui/desktop-workspace.md` | Kit-ul e gândit pentru telefon. Trebuie decis ce se întâmplă cu spațiul de lucru de desktop (întrebarea 4). |
| Repararea lui `dark:` schimbă aspectul | 209 locuri | După linia din 1.2, unele ecrane arată altfel în modul noapte. Se face cu verificare pe telefon. |

---

## 6. Întrebări pentru voi

1. **Tema coral** din Comenzi / Livrări / Recoltări: rămâne ca accent al zonei (și primește variantă de noapte) sau trece pe verdele aplicației?
2. **Asociație** (`/asociatie/*`): intră în revamp? Dacă da, propun pasul 4.
3. **Chat-ul AI** nu are buton de deschidere în interfață. E scos intenționat sau e o scăpare?
4. **Desktop**: păstrăm spațiul de lucru cu panou lateral în modulele care îl au, sau desktopul devine varianta de telefon centrată (cum e acum wizardul din Material săditor, 480 px)?
5. ~~**Analytics**: vreți să rulați voi interogarea din Anexa G sau să reautorizați conectorul?~~ **Rezolvată**: conectorul a fost reautorizat; ambele interogări (`view_module` și `page_view`) au rulat pe 18.11.2026 — Anexa G.
6. **Codul nefolosit** (36 de fișiere): îl ștergem într-un commit separat înainte de Faza 1?

### Decizii (18.11.2026)

- **Tema coral** (Comenzi / Livrări / Recoltări) dispare; un singur set de tokeni pentru toată aplicația. (întrebarea 1)
- **Asociația** (`/asociatie/*`) nu intră în revamp acum; scoasă din ordine, trecută la „mai târziu”. (întrebarea 2)
- **Chat-ul AI** rămâne în cod, neatins și fără buton; în afara revamp-ului. (întrebarea 3)
- **Desktopul** nu intră în revamp acum; vine separat, mai târziu. Regulă: modulele refăcute nu au voie să strice desktopul actual. (întrebarea 4)
- **Fișierele nefolosite** (Anexa E) se șterg într-un pas separat, înainte de Faza 1. (întrebarea 6)
- **Analytics**: rezolvată. (întrebarea 5)

---

# Anexe

## Anexa A — Inventarul modulelor

„Linii” = fișiere `.ts/.tsx` fără teste. Mobil/desktop: **RDV** = `ResponsiveDataView` (carduri pe mobil, tabel pe desktop); **Split** = `DesktopSplitPane` cu inspector; **MQ** = ramificare în JavaScript (`useMediaQuery` / `matchMedia`); **CSS** = doar clase `md:`.

| Modul / rută | Fișier principal (linii) | Rută: fișiere / linii | Componente: fișiere / linii | Formulare | Mobil vs desktop |
|---|---|---|---|---|---|
| `/dashboard` | `dashboard/page.tsx` (1.768, client) | 3 / 1.808 | 13 / 2.083 | — (un dialog „Adaugă widget”) | două stive complete de carduri (`md:hidden` / `hidden md:block`); editarea grilei doar pe desktop |
| `/comenzi` (+ `/comenzi/campanie`) | `ComenziPageClient.tsx` (3.054) | 9 / 4.632 | 7 / 2.765 | `ComandaDialog` (inline), `EditOrderSheet`, `ComenziDinMesajSheet`, confirmare livrare | CSS + MQ; speed dial doar pe mobil; RDV în Campanie |
| `/livrari` | `LivrariPageClient.tsx` (847) | 3 / 861 | 0 (folosește `components/comenzi`) | confirmare livrare | fără nicio clasă `sm:`/`md:`/`lg:`; o coloană la orice lățime |
| `/recoltari` | `RecoltariPageClient.tsx` (1.047) | 4 / 1.093 | 5 / 1.859 | Add, Edit, filtre avansate | o singură listă; bară de acțiune doar pe mobil |
| `/clienti` | `ClientPageClient.tsx` (1.741) | 3 / 1.812 | 10 / 1.159 | Add, Edit, mesaj WhatsApp | RDV |
| `/clienti-magazin` | `page.tsx` (137, server) | 2 / 146 | 0 | — | fără `AppShell`; tabel `min-w-[880px]` cu derulare |
| `/culegatori` | `CulegatorPageClient.tsx` (904) | 3 / 927 | 5 / 716 | Add, Edit | RDV + Split + MQ |
| `/vanzari` | `VanzariPageClient.tsx` (568) | 4 / 614 | 1 / 168 | — (doar „încasat / neîncasat”) | RDV |
| `/vanzari-butasi` (referința) | `VanzariButasiPageClient.tsx` (888) | 3 / 1.001 | 4 / 2.294 | `ComandaButasiWizard` (pe pași) | o coloană; wizardul e ecran întreg pe mobil, 480 px pe desktop |
| `/cheltuieli` | `CheltuialaPageClient.tsx` (990) | 4 / 1.050 | 3 / 754 | Add, Edit | RDV + Split |
| `/investitii` | `InvestitiiPageClient.tsx` (687) | 3 / 722 | 3 / 894 | Add, Edit | RDV + Split |
| `/parcele` (+ `[id]` → redirecționare) | `components/parcele/ParcelePageClient.tsx` (3.291) | 4 / 42 | 22 / 7.409 | teren (Add/Edit), cultură, microclimat, desființare, stadiu | MQ + CSS; foaie de jos cu file pe mobil, inspector pe desktop |
| `/activitati-agricole` | `page.tsx` (706, client) | 2 / 715 | 8 / 1.619 | Add, Edit | aceeași grilă; filtre dublate pentru mobil și desktop |
| `/stocuri` | `StocuriPageClient.tsx` (201) | 4 / 246 | 1 / 176 | ajustare stoc | CSS |
| `/produse` | `ProdusePageClient.tsx` (778) | 3 / 794 | 4 / 1.072 | Add, Edit, ofertă către asociație | RDV + Split + MQ |
| `/rapoarte` | `RapoartePageClient.tsx` (982) | 3 / 1.047 | 0 | — (filtre, export) | CSS; FAB oprit |
| `/analytics-magazin` | `page.tsx` (247, server) | 2 / 259 | 0 | — | fără `AppShell`; grile responsive |
| `/asociatie/*` (8 ecrane) | `association/produse/AssociationProduseClient.tsx` (1.209) | 19 / 328 | 12 / 5.943 | 22 de ferestre și foi în 7 fișiere + o pagină de setări cu 22 de etichete | RDV (2), Split (1), MQ (4) |
| `/notificari` | `NotificariPageClient.tsx` (240) | 3 / 254 | 5 / 882 | — | clopoțelul: listă derulantă pe desktop, dialog pe mobil |
| `/settings` (+ `echipa`, `documente-legale`) | `settings/page.tsx` (1.666, client) | 7 / 2.546 | 3 / 685 | 7 dialoguri; câmpuri salvate unul câte unul; 2 pagini-formular | navigare laterală pe desktop |
| `/planuri` | `page.tsx` (25) | 1 / 25 | 0 | — | nelegată din meniu |
| **Admin** `/admin`, `/admin/analytics`, `/admin/audit` | `admin/analytics/AdminAnalyticsDashboardView.tsx` (599) | 7 / 329 | 7 / 1.700 | — (schimbare de plan în tabel) | doar tabele cu derulare; fără variantă de mobil |

`src/app/admin` nu există; toate rutele de admin sunt în `src/app/(dashboard)/admin`, păzite de `admin/layout.tsx`.

**Componente UI folosite cel mai des** (în câte fișiere sunt importate): `ui/button` 69, `ui/label` 46, `ui/input` 42, `app/AppShell` 33, `app/PageHeader` 32, `ui/textarea` 30, `app/ListSkeleton` 28, `ui/form-dialog-layout` 26, `ui/dialog-form-actions` 26, `app/AppDialog` 23, `ui/dialog` 22, `app/ErrorState` 21, `ui/app-date-picker` 21, `app/DashboardContentShell` 18, `ui/app-select` 17, `app/AppDrawer` 16, `ui/SearchField` 14.

## Anexa B — Formulare

Ordonate după numărul de câmpuri vizibile. „Schemă” = câmpuri în schema zod, unde există.

| Formular | Fișier | Container | Câmpuri vizibile | Schemă | Pași |
|---|---|---|---|---|---|
| Teren (Add / Edit) | `parcele/ParcelForm.tsx` (674) în `AddParcelDrawer` / `EditParcelDialog` | `AppDrawer` / `AppDialog`, lat | până la 14 (15 etichete) | 22 | nu |
| Setări asociație | `association/settings/AssociationSettingsClient.tsx` | pagină | 22 de etichete, 24 de controale | — | nu |
| Profil producător | `association/producatori/ProducerProfileEditor.tsx` | foaie pe mobil / dialog pe desktop | 8 etichete, 12 controale | — | nu |
| Comandă (creare / editare) | `ComenziPageClient.tsx:970-1600` | `AppDialog`, lat, ecran întreg pe mobil | până la 9 | fără | nu |
| Comandă (editare din card) | `comenzi/EditOrderSheet.tsx` (607) | `Sheet` jos pe mobil / `Dialog` pe desktop | 9 | fără | nu |
| Comandă din mesaj | `comenzi/ComenziDinMesajSheet.tsx` (814) | `Sheet` jos | 9 | fără | 2 faze |
| Cultură | `parcele/AddCulturaDialog.tsx` (401) | `AppDrawer` | până la 9 | 10 | nu |
| Produs (Edit / Add) | `produse/EditProdusDialog.tsx`, `AddProdusDialog.tsx` | `AppDialog` / `AppDrawer` | 9 / 8 (+1 condiționat) | 9 / 8 | nu |
| Client | `clienti/ClientForm.tsx` (187) | `AppDrawer` / `AppDialog` | 8 (7 la editare) | 8 | nu |
| Recoltare (Add / Edit) | `recoltari/AddRecoltareDialog.tsx` (841), `EditRecoltareDialog.tsx` (555) | `AppDrawer` / `AppDialog`, lat | 7 | 7 | nu |
| Culegător | `culegatori/CulegatorForm.tsx` (172) | `AppDrawer` / `AppDialog` | 7 | 7 | nu |
| Investiție (Add / Edit) | `investitii/AddInvestitieDialog.tsx` (502), `EditInvestitieDialog.tsx` (302) | `AppDrawer` / `AppDialog` | 6 | 6 | nu |
| Cheltuială (Add / Edit) | `cheltuieli/AddCheltuialaDialog.tsx` (461), `EditCheltuialaDialog.tsx` (209) | `AppDrawer` / `AppDialog` | 5 | 6 / 5 | nu |
| Activitate | `activitati-agricole/ActivitateAgricolaForm.tsx` (444) | `AppDrawer` / `AppDialog` | 4 | 7 | nu |
| Ajustare stoc | `stocuri/AjustareStocDialog.tsx` (176) | `AppDrawer` | 4 | fără | nu |
| Stadiu cultură | inline în `ParcelePageClient.tsx` | `ResponsiveFormContainer` (în pagină pe mobil) | 3–4 | — | nu |
| Microclimat | `parcele/AddMicroclimatDialog.tsx` | `AppDialog` | 3 | 3 | nu |
| Desființare cultură | `parcele/DesfiinteazaCulturaDialog.tsx` | `AppDialog` | 2 | 2 | nu |
| **Comandă material săditor** | `vanzari-butasi/ComandaButasiWizard.tsx` (1.507) | `Dialog` pe tot ecranul | 1 decizie pe ecran | fără | **da**: sursă → client → soiuri → cantitate pe soi → avans → livrare → verificare |

## Anexa C — Straturi

Elemente `fixed` din dashboard și componente comune (din 40 de apariții în tot `src/`, 27 sunt aici):

| Element | Fișier:linie | z-index | În portal? | În stratul `z-10` al paginii? |
|---|---|---|---|---|
| Bara de jos | `app/BottomTabBar.tsx:70` | 50 | nu | nu (layout) |
| FAB global | `ui/UnifiedMobileFab.tsx:44` | 42 | nu | nu (layout) |
| Widget beta | `beta-widget.tsx:66` | 40 | nu | nu (layout) |
| Bara de acțiune a paginii | `app/AppShell.tsx:35` | 40 | nu | nu (în `AppShell`, lângă strat) |
| Speed dial Comenzi | `comenzi/ComenziSpeedDial.tsx:26,31,57` | 41 / 44 / 45 | nu | **da** |
| Bara de sumar Livrări asociație | `association/livrari/AssociationLivrariClient.tsx:534` | 20 | nu | **da** |
| Sugestii clienți (Comenzi) | `comenzi/ComenziPageClient.tsx:1280` | 1100 | da (`createPortal`) | nu |
| Foaia din Material săditor | `vanzari-butasi/VanzariButasiPageClient.tsx:281` | 1001 | da (`createPortal`) | nu |
| Dialog / foaie / alertă (Radix) | `ui/dialog.tsx:92`, `ui/sheet.tsx:39-45`, `ui/alert-dialog.tsx:41` | 1001 | da | nu |
| Fundalul ferestrelor | `lib/ui/modal-overlay-classes.ts:3` | 1000 | da | nu |
| Liste derulante | `ui/popover.tsx:33`, `ui/select.tsx:78`, `ui/app-select.tsx:385`, `ui/app-date-picker.tsx:414` | 1105 | da | nu |
| Foaia AI | `ai/AiBottomSheet.tsx:728,739` | 80 / 81 (50 / 51 ca panou) | nu | nu (layout) |
| Bara laterală | `layout/Sidebar.tsx:497` | 40 | nu | nu |
| Indicator de navigare | `app/RouteTransitionIndicator.tsx:103` | 120 | nu | nu |
| (nefolosite) | `app/MoreMenu.tsx:96`, `mobile/StickyActionButton.tsx:12`, `activitati-agricole/ConfirmDeleteActivitateDialog.tsx:29` | 90 / 40 / 1100 | nu | — |

Toate valorile de z-index întâlnite (valoare × apariții): 0×1, 1×3, 10×14, 20×6, 30×4, 40×12, 41×1, 42×1, 44×1, 45×2, 50×7, 59×1, 60×5, 70×2, 75×1, 80×1, 90×1, 100×1, 120×1, 190×1, 300×2, 1000×1, 1001×7, 1002×1, 1100×2, 1105×4, 1200×1.

## Anexa D — Unde e definit fiecare grup de tokeni

| Fișier | Bloc | Familii (număr de tokeni) |
|---|---|---|
| `globals.css` | `:root` (l. 4–133) | shadcn (18), `--agri-*` (22), `--soft-*` (12), `--brand-*` (11), `--pill-*` (7), `--ai-*` (7), `--button-*` (4), `--safe-*` (4), `--status-purple-*` (3), `--fab-*` (3), `--value-*` (2), `--skeleton-*` (2), `--touch-*` (2), dimensiuni |
| `globals.css` | `.dark` (l. 135–239) | aceleași, pentru noapte (`--agri-*` 18) |
| `globals.css` | `@theme inline` (l. 241) | `--color-*` (18), `--radius-*` (4) — doar setul shadcn e expus ca clase Tailwind |
| `globals.css` | `html.high-visibility-mode`, `html[data-density='compact']` | `--agri-*` (10 / 5), `--touch-*` |
| `theme.css` | `:root` (l. 1–107), `.dark` (l. 109–213) | `--surface-*` (7), `--text-*` (4), `--border-*` (2), `--status-*` (15), stări (15), `--shadow-*` (4), `--agri-*` (12), `--cta-*` (8), `--indicator-*` (5), `--badge-*` (3), `--bg-*` (3), `--input-*` (3) |
| `zmeurel-orders.module.css` | `.theme` | 111 (95 suprascriu nume globale) |
| `gusta-brand.css` | `.assoc-root` + variante | `--gusta-*` (36 + 18 + 18) |
| `association-shop.css` | `.assoc-root` | `--assoc-*` (7) |
| `comanda/comanda.module.css` | `.root` | `--coral`, `--ink`, `--bg`, `--line`, `--wa`, `--plum` |
| `lib/design-tokens.ts` | obiecte JS | `colors`, `radius`, `shadows`, `spacing` |

Cei mai folosiți tokeni: `--text-secondary` 425, `--text-primary` 367, `--agri-text` 349, `--agri-text-muted` 349, `--border-default` 225, `--surface-card` 196, `--agri-border` 187, `--agri-surface` 180, `--text-tertiary` 177, `--surface-card-muted` 150, `--agri-primary` 138, `--agri-surface-muted` 113.

## Anexa E — Fișiere nereferite (candidați la ștergere)

Criteriu: numele fișierului nu apare în niciun alt `.ts/.tsx` din `src/`, în afara testelor. 36 de fișiere, 6.475 de linii.

| Zonă | Fișiere (linii) |
|---|---|
| `components/parcele` | `EditCulturaDialog` (386), `AddStadiuDialog` (255), `EditParcelaDialog` (233), `ParceleList` (205), `AddParcelaDialog` (171), `CulturiBara` (57). În plus `ParcelaForm` (287) e importat doar de `AddParcelaDialog`. |
| `components/vanzari-butasi` | `VanzareButasiCard` (439), `ViewVanzareButasiDialog` (251), `VanzareButasiFormSummary` (97) |
| `components/clienti` | `ClientCard` (216), `ClientDetailsDrawer` (193), `ClientImportHelpDialog` (98), `ClientImportPreviewPanel` (96), `ClientImportResultDialog` (93) |
| `components/activitati-agricole` | `ActivityDetailSheet` (215), `ActivityDetailDialog` (210), `ConfirmDeleteActivitateDialog` (137), `ActivitateAgricolaCard` (75) |
| `components/app` | `MoreMenu` (369), `SyncStatusIndicator` (299), `FeedbackBanner` (84), `QuickActionsPanel` (54), `StatusChip` (48), `TopBar` (45), `HighVisibilityToggle` (36) |
| `components/ui`, `mobile` | `command` (184), `MiniCard` (98), `StickyActionButton` (21); `ui/form.tsx` (184) are 0 importuri |
| altele din dashboard | `culegatori/CulegatorCard` (225), `comenzi/ErpLocalitySelector` (185), `vanzari/ViewVanzareDialog` (168), `recoltari/RecoltareCard` (159), `admin/BetaUsersContactTable` (127) |
| zona publică | `shop/AssociationShopClient` (670), `pwa/PwaInstallBanner` (271), `shop/association/AssociationShopApp` (5) |

## Anexa F — Comenzile folosite

Toate rulate din rădăcina repo-ului, pe HEAD `1e3ca48`. Domeniu: 723 de fișiere (415 `.tsx`, 302 `.ts`, 6 `.css`).

```bash
# Domeniul (P) — pentru culori, text și ținte se scot fișierele .css
P="'src/*.tsx' 'src/*.ts' 'src/*.css' ':(exclude)src/**/__tests__/**' ':(exclude)src/types/supabase.ts' ':(exclude)src/**/*.test.ts' ':(exclude)src/**/*.test.tsx'"

# Tipar general: apariții și fișiere
git grep -oP '<TIPAR>' -- $P | wc -l                               # apariții
git grep -oP '<TIPAR>' -- $P | cut -d: -f1 | sort -u | wc -l       # fișiere
# Defalcarea pe zone: același rezultat, grupat după prefixul căii (awk).
```

| # | Ce numără | Tipar (`git grep -oP`) |
|---|---|---|
| 1 | `dark:` | `(?<![\w-])dark:[\w\[\(!-]` |
| 2 | Variantă dark configurată | `git grep -nE "@config\|@custom-variant\|@variant \|@plugin\|@source" -- '*.css'` → 0 rezultate |
| 3 | Utilizări pe familie de tokeni | `var\(--agri-[a-z0-9-]+` (la fel pentru `surface`, `text`, `soft`, `status`, `brand`, `pill` …) |
| 4 | Tokeni definiți | `git grep -ohP '^\s*--[a-z0-9-]+(?=\s*:)' -- src/app/globals.css src/styles/theme.css \| sort -u` |
| 5 | Tokeni folosiți; nedefiniți; nefolosiți | `git grep -ohP 'var\(\s*--[a-zA-Z0-9-]+' -- $P \| sort -u`, apoi `comm` față de lista de la 4 |
| 6 | Hex | `#(?:[0-9a-fA-F]{8}\|[0-9a-fA-F]{6}\|[0-9a-fA-F]{3})(?![0-9a-zA-Z])`; în `className`: `\[#…\]` |
| 7 | Paleta Tailwind | `(?<![\w-])(bg\|text\|border\|ring\|fill\|stroke\|from\|to\|via\|outline\|divide\|placeholder\|decoration\|shadow\|accent\|caret)-(red\|green\|emerald\|amber\|yellow\|orange\|blue\|sky\|slate\|gray\|zinc\|neutral\|stone\|rose\|pink\|lime\|teal\|cyan\|indigo\|violet\|purple\|fuchsia)-\d{2,3}(?![\w])` |
| 8 | Alb/negru; `rgb()`; inline | `(?<![\w-])(bg\|text\|border)-(white\|black)(?![\w-])`; `(?<![\w-])(rgba?\|hsla?)\(\s*\d`; `style=\{\{` |
| 9 | Importuri pe componentă | `git grep -lP "from ['\"]@/components/<cale>['\"]" -- 'src/*.ts' 'src/*.tsx' ':(exclude)src/**/__tests__/**' \| wc -l` |
| 10 | z-index | `(?<![\w-])z-\[?\d+\]?(?![\w-])`; `zIndex:\s*\d+`; `z-index:\s*\d+` |
| 11 | `fixed` | `(?<=["'\x60\s])fixed(?=["'\x60\s])`; `position:\s*'fixed'`; portal: `createPortal\(` |
| 12 | Text mic | `(?<![\w-])text-\[(?:[0-9]\|1[0-2])(?:\.\d+)?px\]`; `(?<![\w-])text-xs(?![\w-])`; `fontSize:\s*(?:[0-9]\|1[0-2])(?![0-9.])` |
| 13 | Histograma de text | `(?<![\w-])text-\[\d+(\.\d+)?px\]` și `(?<![\w:-])text-(xs\|sm\|base\|lg\|xl\|2xl\|3xl\|4xl\|5xl)(?![\w-])`, cu `sort \| uniq -c` |
| 14 | Butoane | `<Button\b`; `<button\b`; `size="(?:xs\|sm\|icon\|icon-sm\|icon-xs)"`; `(?<![\w-])agri-control(?![\w-])` |
| 15 | Înălțimi | `(?<![\w:-])(?:h\|size)-(?:6\|7\|8\|9\|10\|11)(?![\w./-])`; `(?<![\w:-])(?:h\|min-h\|size)-\[(?:[12]\d\|3\d\|4[0-7])px\]` |
| 16 | Raze / umbre | `(?<![\w:-])rounded(?:-(?:t\|b\|l\|r\|tl\|tr\|bl\|br))?-\[[^\]]+\]`; `(?<![\w:-])shadow-\[(?!var)[^\]]+\]` |
| 17 | Fișiere nereferite | pentru fiecare `.tsx` din `src/components` și `src/app/(dashboard)` (fără `page`, `layout`, `loading`, `error`): `git grep -lP "(?<![\w])<Nume>(?![\w])" -- 'src/*.ts' 'src/*.tsx'`, fără teste și fără fișierul însuși → 0 |
| 18 | Câmpuri din formulare | script `perl` pe fiecare fișier: etichete distincte (`<Label>…`, `label="…"`) și chei din primul `z.object({…})` |
| 19 | e2e | `grep -oE "getByRole\(\|getByText\(\|getByTestId\(\|locator\("` pe fiecare `e2e/*.spec.ts`; rute: `git grep -ohP "goto\(\s*['\"\x60][^'\"\x60]+" -- e2e tests-e2e` |

Limite cunoscute: (15) nu poate separa butoanele de iconițe; (17) e pe nume de fișier, nu pe un build; (6) include hex din șabloane de e-mail, SVG și configurări, nu doar din interfață.

## Anexa G — Interogările de analytics (rulate)

Rulate pe **18.11.2026**, pe proiectul de producție `ilybohhdeplwcrbpblqw`, prin conectorul Supabase (`execute_sql`). Doar `SELECT` pe `public.analytics_events`; nicio altă tabelă, nimic scris. În repo intră doar agregate anonimizate.

**Volum și perioadă.** 404 evenimente `page_view` în ultimele 90 de zile (20.08–18.11.2026); primul `page_view` din toată tabela e din 15.03.2026, deci fereastra e acoperită integral. 5 tenanți reali (402 vizualizări) și 1 tenant demo (2). Un singur tenant real are 360 de vizualizări. Cifrele se citesc ca tendință, nu ca măsurătoare.

### Interogarea A — `view_module`

```sql
with v as (
  select tenant_id, module, count(*)::int as views
  from public.analytics_events
  where event_name = 'view_module'
    and created_at >= now() - interval '90 days'
  group by tenant_id, module
),
demo as (
  select distinct tenant_id
  from public.analytics_events
  where event_name = 'demo_started'
),
t as (
  select tenant_id, sum(views)::int as total from v group by tenant_id
)
select 'T' || dense_rank() over (order by t.total desc, v.tenant_id) as tenant,
       (d.tenant_id is not null) as has_demo_event,
       v.module,
       v.views
from v
join t using (tenant_id)
left join demo d using (tenant_id)
order by t.total desc, v.tenant_id, v.views desc;
```

Rezultat (4 tenanți, toți reali; niciun tenant demo nu are `view_module`):

| Tenant | Recoltări | Parcele | Activități | Total |
|---|---:|---:|---:|---:|
| T1 | 45 | — | — | 45 |
| T2 | 3 | 2 | 1 | 6 |
| T3 | 3 | — | 1 | 4 |
| T4 | — | 1 | — | 1 |
| **Total** | **51** | **3** | **2** | **56** |

Cheltuieli, Produse și Vânzări (care emit `view_module`) nu au niciun eveniment în 90 de zile.

### Interogarea B — `page_view` pe rută normalizată

```sql
with pv as (
  select tenant_id,
         created_at,
         regexp_replace(
           regexp_replace(
             regexp_replace(
               split_part(split_part(event_data->>'page', '?', 1), '#', 1),
               '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=/|$)', '/[id]', 'gi'),
             '/[0-9]+(?=/|$)', '/[id]', 'g'),
           '(.)/+$', '\1') as route
  from public.analytics_events
  where event_name = 'page_view'
    and created_at >= now() - interval '90 days'
    and event_data->>'page' is not null
),
r as (
  select tenant_id, route,
         count(*)::int as views,
         count(distinct (created_at at time zone 'Europe/Bucharest')::date)::int as active_days
  from pv
  group by tenant_id, route
),
t as (select tenant_id, sum(views)::int as total from r group by tenant_id),
demo as (
  select distinct tenant_id from public.analytics_events where event_name = 'demo_started'
)
select 'T' || dense_rank() over (order by t.total desc, r.tenant_id) as tenant,
       (d.tenant_id is not null) as has_demo_event,
       r.route,
       r.views,
       r.active_days,
       (select min(created_at)::date from public.analytics_events where event_name = 'page_view') as first_page_view_date
from r
join t using (tenant_id)
left join demo d using (tenant_id)
order by t.total desc, r.tenant_id, r.views desc;
```

Normalizare: se scot query string-ul și fragmentul, segmentele uuid și numerice devin `[id]`, se scoate `/` final. Ziua activă se socotește în `Europe/Bucharest`. Pe perioada analizată nu a apărut nicio rută cu `[id]` și nicio rută nemapată.

**Tenanți reali — vizualizări / zile active, pe module**

| Modul (rută) | T1 | T2 | T3 | T4 | T6 | Total vizualizări | Zile active (însumate) |
|---|---|---|---|---|---|---:|---:|
| Comenzi (`/comenzi`) | 131 / 32 | 4 / 1 | 2 / 2 | — | — | 137 | 35 |
| Livrări (`/livrari`) | 88 / 20 | 2 / 1 | 3 / 2 | — | — | 93 | 23 |
| Dashboard (`/dashboard`) | 52 / 24 | 10 / 2 | 4 / 3 | 1 / 1 | 1 / 1 | 68 | 31 |
| Recoltări (`/recoltari`) | 47 / 15 | 4 / 1 | 3 / 2 | — | — | 54 | 18 |
| Material săditor (`/vanzari-butasi`) | 38 / 2 | — | — | — | — | 38 | 2 |
| Parcele (`/parcele`) | — | 2 / 1 | — | 1 / 1 | — | 3 | 2 |
| Rapoarte (`/rapoarte`) | 1 / 1 | 2 / 1 | — | — | — | 3 | 2 |
| Activități (`/activitati-agricole`) | — | 1 / 1 | 1 / 1 | — | — | 2 | 2 |
| Clienți (`/clienti`) | 1 / 1 | — | — | — | — | 1 | 1 |
| Culegători (`/culegatori`) | — | 1 / 1 | — | — | — | 1 | 1 |
| Notificări (`/notificari`) | 1 / 1 | — | — | — | — | 1 | 1 |
| Admin (`/admin/analytics`) | 1 / 1 | — | — | — | — | 1 | 1 |
| **Total** | **360** | **26** | **13** | **2** | **1** | **402** | |

Fără nicio vizualizare: Cheltuieli, Investiții, Vânzări, Stocuri, Produse, Setări, Asociație, Clienți magazin, Analytics magazin, Planuri.

**Tenanți demo** (`has_demo_event` adevărat): un tenant (T5), 2 vizualizări pe `/dashboard`, într-o zi.

**Rute publice** (magazin, comandă, livrator, landing, auth, start): niciuna. `PageViewTracker` e montat doar prin `<Providers>` din `(dashboard)/layout.tsx`, iar `track()` cere utilizator cu tenant, deci zona publică nu e măsurată de `page_view`.

Note:
- Ambele interogări ating doar `analytics_events`. Nu întorc `user_id`, e-mail, alte câmpuri din `event_data` sau identificatori reali de tenant.
- Etichetele T sunt calculate separat în fiecare interogare, după volumul propriu: T1 din A nu e neapărat T1 din B.
- Tenanții demo sunt marcați, nu excluși: `has_demo_event` e adevărat dacă tenantul are vreun `demo_started` (`(onboarding)/start/page.tsx:288`). Numărul mic de tenanți demo poate veni și din curățarea zilnică a tenanților demo (nu am verificat dacă evenimentele lor se șterg odată cu ei).
- `view_module` e emis doar din 6 pagini (activități, cheltuieli, parcele, produse, recoltări, vânzări); de aceea comparația între module se face pe `page_view`. Pe zona comună, cele două surse se potrivesc (de ex. Recoltări: 51 `view_module`, 54 `page_view`).
