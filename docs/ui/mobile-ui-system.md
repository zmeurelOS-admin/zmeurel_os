# Mobile UI System

## 1. Scop

- Zmeurel UI este mobile-first pentru un produs SaaS agricol folosit zilnic in teren.
- Interfata prioritizeaza scanare rapida (sub aproximativ 2 secunde pentru informatia critica).
- Claritatea operationala are prioritate peste efectele decorative.
- Componentele sunt optimizate pentru utilizare in conditii reale (lumina puternica, miscare, interactiuni scurte).
- Sistemul trebuie sa ramana predictibil intre module, astfel incat utilizatorul sa nu reinvete UI la fiecare ecran.

## 2. Principii UI (MANDATORY RULES)

- Mobile-first by default; desktop este doar extensie progresiva.
- Fara card-in-card in fluxurile standard de lista si detalii.
- Fara UI decorativ care reduce lizibilitatea sau contrastul.
- Ierarhie consistenta: title -> subtitle -> values -> meta.
- Doar semantic tokens; fara culori hardcodate in componente.
- Status tones standardizate si reutilizabile.
- Cognitive load minim: texte scurte, semnale clare, densitate controlata.

## 3. Theme System (CRITICAL)

Implementarea reala foloseste:

- `src/styles/theme.css` pentru definitia token-urilor semantice in `:root` si `.dark`.
- `src/lib/ui/theme.ts` pentru maparea status tones la seturile de token-uri.
- `src/components/app/ThemeProvider.tsx` cu `next-themes` (`attribute="class"`, `storageKey="theme"`), sursa unica de adevar pentru tema.

Cum se aplica tema:

- `next-themes` aplica clasa `.dark` pe document cand tema activa este dark.
- Token-urile din `:root` sunt folosite in light, iar valorile din `.dark` suprascriu semantic aceleasi token-uri.
- Componentele citesc aceleasi variabile CSS (`var(--...)`) indiferent de tema; se schimba doar valoarea token-ului.

De ce sunt obligatorii semantic tokens:

- Pastreaza consistenta intre module fara duplicate locale.
- Reduc regressions la schimbari de paleta.
- Separarea intentiei (semantic token) de valoare (hex actual) permite mentenanta fara a rescrie componente.

De ce sunt interzise culorile Tailwind hardcodate:

- Bypass la sistemul central de tema.
- Creeaza light/dark drift si contraste inconsistente.
- Introduce logica paralela de styling in componente.

## 4. Semantic Tokens

- **Surfaces** (`--surface-page`, `--surface-card`, `--surface-card-muted`, `--surface-card-elevated`): definesc straturile de fundal si separarea vizuala.
- **Text** (`--text-primary`, `--text-secondary`, `--text-tertiary`, `--text-on-accent`): controleaza ierarhia de citire.
- **Borders/Dividers** (`--border-default`, `--border-strong`, `--divider`): delimiteaza structura fara zgomot vizual.
- **Inputs/Focus** (`--input-bg`, `--input-border`, `--input-placeholder`, `--focus-ring`): accesibilitate, stare de editare, focus clar.
- **Status tones** (`--success-*`, `--warning-*`, `--danger-*`, `--info-*`, `--neutral-*`): semnificatie functionala standardizata.
- **Shadows** (`--shadow-soft`, `--shadow-elevated`): adancime discreta, fara a inlocui ierarhia informationala.

## 5. Status Tone System

Status disponibile:

- `success`: confirmari, stari bune, rezultate finalizate cu succes.
- `warning`: atentionari operationale care necesita verificare.
- `danger`: erori, riscuri, blocaje sau actiuni distructive.
- `info`: context informativ neutru, non-critic.
- `neutral`: etichete de stare fara urgenta.

Reguli:

- Nu se amesteca semnificatia statusului cu culori raw.
- Toate badge-urile/status labels trebuie sa consume `getStatusToneTokens(...)`.
- `src/lib/ui/theme.ts` este singurul loc pentru maparea tone -> token set.

## 6. Primitive Components (CORE CONTRACT)

- **AppCard** (`src/components/ui/app-card.tsx`)
  - Reprezinta containerul semantic de baza pentru sectiuni de continut.
  - Se foloseste pentru structura generala a cardurilor.
  - Nu se transforma in sistem ad-hoc de culori locale.

- **MobileEntityCard** (`src/components/ui/MobileEntityCard.tsx`)
  - Pattern standard pentru randurile de lista mobile.
  - Se foloseste pentru elemente scanabile cu date esentiale.
  - Nu se adauga layout-uri custom care rup ordinea campurilor standard.

- **Badge** (`src/components/ui/badge.tsx`)
  - Eticheta scurta pentru stari si clasificari.
  - Se foloseste cu variante bazate pe status tone.
  - Nu se adauga culori hardcodate pentru semnificatie.

- **PageHeader** (`src/components/app/PageHeader.tsx`)
  - Header principal de pagina cu context, actiuni si navigatie.
  - Se foloseste ca punct de intrare vizual consistent per modul.
  - Nu se cloneaza local cu structuri paralele.

- **CompactPageHeader** (`src/components/layout/CompactPageHeader.tsx`)
  - Varianta compacta pentru ecrane dense/mobile.
  - Se foloseste cand spatiul vertical trebuie optimizat.
  - Nu se combina cu alte tipare de header pe acelasi ecran.

- **KpiCard** (`src/components/app/KpiCard.tsx`)
  - Card pentru valori agregate (KPI).
  - Se foloseste pentru indicatori rapizi, nu pentru liste detaliate.
  - Nu se supraincarca cu meta-text lung sau controale inutile.

- **ListSkeleton** (`src/components/app/ListSkeleton.tsx`)
  - Stare de incarcare pentru liste/carduri.
  - Se foloseste pentru continuitate vizuala in loading.
  - Nu se inlocuieste cu blocuri random care schimba densitatea ecranului.

## 7. List Pattern (VERY IMPORTANT)

Structura standard in mobile list items:

- `title`
- `subtitle`
- `mainValue`
- `secondaryValue`
- `meta`
- `statusLabel`

Reguli de comportament:

- Scanarea incepe din stanga sus (`title/subtitle`) si se inchide in dreapta (`mainValue/statusLabel`).
- Valorile numerice trebuie aliniate consecvent in zona dreapta pentru comparatie rapida.
- `meta` ramane contextual, scurt, sub zona principala, fara a domina cardul.
- Spacing-ul ramane constant intre randuri/campuri pentru memorie musculara.
- Consistenta intre module reduce erorile de operare si timpul de cautare.

## 8. Dashboard Logic (HIGH VALUE)

Starea actuala documentata:

- Contextul fermei este detectat cu prioritate pentru solar comercial.
- `primaryContext` devine `solar` cand exista solar comercial relevant; altfel `camp` (cu fallback pe toate parcelele cand lipsesc comerciale).
- Meteo/recomandari folosesc microclimatul daca datele sunt recente (fereastra 24h).
- Daca microclimatul lipseste sau este vechi, se face fallback la meteo exterior.
- Recomandarile combina reguli deterministe de context (solar/camp), task-uri, alerte si semnale meteo.
- Mesajele de incredere in date comunica explicit cand recomandarile sunt estimate vs. precise.

## 9. Nudging System

- Nudges sunt subtile si contextuale, integrate in UI existent.
- Fara popups intruzive, fara spam, fara notificari agresive.
- Prompturile apar doar cand lipsesc date critice (ex. microclimat recent).
- Dupa input valid, se afiseaza confirmari scurte orientate pe valoare.
- Scopul este cresterea calitatii datelor pentru recomandari mai precise, nu cresterea interactiunilor artificiale.

## 10. Ce este INTERZIS (STRICT)

- Culori hardcodate in componente (`bg-white`, `text-red-500`, etc.).
- Hack-uri locale dark/light la nivel de componenta.
- Ocolirea semantic tokens prin valori directe.
- Spacing inconsistent intre carduri, liste si headere similare.
- Mix de pattern-uri UI multiple pentru acelasi tip de date.
- Introducerea de primitive UI noi fara actualizarea sistemului (`theme.css`, `theme.ts`, documentatia UI).

## 11. Desktop workspace (fara regresii mobil)

- Extensia **desktop** (master–detail, toolbar, inspector) se aplică de la **`md+`**; **nu înlocuiește** și **nu rupe** layout-ul mobil documentat mai sus.
- Detali: `docs/ui/desktop-workspace.md`. Modul de referință pentru pattern: **Comenzi** (`ComenziPageClient.tsx`).
