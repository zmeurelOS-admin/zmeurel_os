# Desktop workspace (md+)

## Scop

- Pe breakpoint-uri **`md` și mai mari**, modulele de tip listă pot adopta un **workspace master–detail** (listă stânga, inspector dreapta), fără a înlocui fluxul mobil.
- **Mobilul rămâne sursa de adevăr** pentru layout sub `md`: același markup ca înainte pentru grid-ul de carduri (`ResponsiveDataView` ramura mobilă), fără panou lateral.
- **Nu modifica** comportamentul de business, API-uri sau date; doar structură UI și accesibilitatea acțiunilor pe desktop.

## Primitive (referință)

- `DesktopSplitPane` — grid master/detail doar de la `md` încolo; coloana de detalii este **`hidden` sub `md`** ca lista să nu împingă un al doilea panou pe mobil.
- `DesktopToolbar` — bară unificată sub filtre/tab-uri modul: căutare, filtre desktop, acțiuni; ascunsă pe mobil când modulul are deja `SearchField` dedicat mobil.
- `DesktopInspectorPanel` / `DesktopInspectorSection` — shell pentru panoul dreapta (header, scroll body, footer acțiuni) și secțiuni etichetate.

Locație cod: `src/components/ui/desktop/`.

- **Formulare modale**: `AppDialog`, `AppDrawer` și `FormDialogLayout` (`src/components/ui/form-dialog-layout.tsx`); `desktopFormWide` + `FormDialogSection` pentru varianta „foaie” pe desktop fără alt container.

## Modul de referință

- **`src/app/(dashboard)/comenzi/ComenziPageClient.tsx`** — pattern oficial: căutare desktop în `DesktopToolbar`, listă cu `ResponsiveDataView` (`skipDesktopDataFilter` + `hideDesktopSearchRow` când filtrarea e deja în page), inspector structurat pe secțiuni. **Formular Add/Edit comandă**: `desktopFormWide` + `FormDialogSection` + **rezumat live** într-un `aside` dreapta doar de la `md+` (client, contact, total estimat din câmpuri, status, observații scurt); mobil: aceeași ordine de câmpuri, fără coloană laterală.
- **`src/app/(dashboard)/recoltari/RecoltariPageClient.tsx`** — al doilea modul care validează reutilizarea: același trio de primitive, totaluri relevante pe `DesktopToolbar` pe desktop, `StickyActionBar` doar pe mobil (`md:hidden`). **Add/Edit recoltare** (`AddRecoltareDialog`, `EditRecoltareDialog`): `desktopFormWide` + `FormDialogSection` + panou **Rezumat live** lipit dreapta (`md+`), același calcul de plată ca înainte; pe mobil cardul „Rezumat plată” rămâne în flux (`md:hidden` / aside `hidden md:block`).
- **`src/app/(dashboard)/culegatori/CulegatorPageClient.tsx`** — tabel desktop + `DesktopSplitPane` / inspector; dialogul de detaliu rămâne doar sub `md`. **Add/Edit culegător** (`AddCulegatorDialog`, `EditCulegatorDialog`): `desktopFormWide` + `FormDialogSection` + **aside** `md+` (previzualizare câmpuri; la edit + rezumat sezon/ultima recoltare din `workerStats` deja pe pagină, fără query în dialog); mobil fără coloană laterală.
- **`src/app/(dashboard)/vanzari/VanzariPageClient.tsx`** — **Add/Edit vânzare** (`AddVanzareDialog`, `EditVanzareDialog`): același pattern (secțiuni Client / Vânzare / Financiar / Observații + aside **Previzualizare** pe `md+`: total live `kg × preț`, status, număr vânzări pe client din lista deja încărcată în pagină prin prop `tenantVanzari`, fără fetch nou).
- **`src/app/(dashboard)/produse/ProdusePageClient.tsx`** — catalog intern: pe `md+` **DesktopToolbar** (căutare, filtre categorie/status, „Adaugă produs”), **ResponsiveDataView** tabel + **DesktopSplitPane** / **DesktopInspectorPanel** (detaliu, imagini, acțiuni); mobil: carduri `MobileEntityCard` + filtre pill, fără inspector. **Add/Edit** (`AddProdusDialog`, `EditProdusDialog`): `desktopFormWide` + `FormDialogSection` + aside previzualizare; logică/fotografii neschimbată.
- **`src/app/(dashboard)/cheltuieli/CheltuialaPageClient.tsx`** — registru financiar: `md:max-w-7xl`, toolbar desktop cu total RON + număr înregistrări în filtru, tabel existent + inspector; **Add/Edit**: același `AppDrawer` / `AppDialog` + `FormDialogLayout` cu `desktopFormWide` (modal centrat mai lat de la `md+`), secțiuni `FormDialogSection`; sub `md` lățimea rămâne compactă (`sm:max-w-lg`).
- **`src/app/(dashboard)/investitii/InvestitiiPageClient.tsx`** — simetric cu Cheltuieli pentru CAPEX: același split + toolbar + inspector, lățime `md:max-w-7xl`; Add/Edit folosesc `desktopFormWide` + `FormDialogSection` ca la OPEX (`AddInvestitieDialog`, `EditInvestitieDialog`).
- **`src/app/(dashboard)/stocuri/StocuriPageClient.tsx`** — pattern **filtre + tabel + inspector** pe desktop: grilă cu trei coloane (`md+`), filtre în stânga (sticky), tabel `ResponsiveDataView` în centru, `DesktopInspectorPanel` în dreapta; căutarea desktop e doar în `DesktopToolbar` (`skipDesktopDataFilter` + `hideDesktopSearchRow` pe listă); pe sub `md` rămâne fluxul vertical cu același card de filtre deasupra listei.
- **Setări** (`src/app/(dashboard)/settings/page.tsx`) — al doilea pattern desktop: *Settings Shell* cu nav lateral sticky (`DesktopSettingsNav`, doar `md+`) și conținut în dreapta; mobil: coloană unică, fără nav.

## Subpattern: filtre + tabel + inspector (Stocuri)

- Folosește o **grilă cu trei coloane** pe `md+` în loc de `DesktopSplitPane` (split-ul din primitive acoperă două coloane).
- **Stânga**: aceleași controale de filtru ca pe mobil, într-o coloană îngustă, `sticky` + scroll vertical dacă lista de filtre e lungă.
- **Centru**: tabel desktop din `ResponsiveDataView`; selecție rând + hover folosesc deja props `onDesktopRowClick` / `isDesktopRowSelected`.
- **Dreapta**: `DesktopInspectorPanel` cu sumar derivat din datele deja încărcate în pagină (fără query suplimentar obligatoriu).

## Formulare desktop (Add/Edit — pilot Cheltuieli)

- **Același** dialog și aceeași logică (React Hook Form, Zod, mutații); doar **prezentare** și lățime: prop `desktopFormWide` pe `AppDialog` / `AppDrawer` → `FormDialogLayout` aplică de la `md+` `max-w-4xl`, padding mai generos, titlu puțin mai mare.
- **Secțiuni**: `FormDialogSection` din `form-dialog-layout.tsx` (titlu tip „eyebrow”) pentru scanare pe ecran mare; pe mobil secțiunile sunt aceleași, fără layout nou tip split.
- **Extindere**: același pattern este validat și pentru **Investiții (CAPEX)**; alte module pot reutiliza prop + secțiuni fără framework nou.

## ResponsiveDataView

- `skipDesktopDataFilter`: evită dublarea filtrului când lista e deja filtrată în părinte.
- `hideDesktopSearchRow`: ascunde rândul intern de căutare desktop; părintele expune o singură sursă de căutare (ex. toolbar).

## Navigație desktop (Sidebar)

- Grupul **Fermă** include și **`/activitati-agricole`** (Activități agricole), aliniat cu bara de tab-uri mobilă care avea deja destinația; ordinea în grup: Parcele → Recoltări → Activități agricole → Culegători.
- **Superadmin**: grup separat **Administrare** (`md+`, `Sidebar.tsx`) cu `/admin`, `/admin/analytics`, `/admin/audit`; vizibil doar dacă `isSuperAdmin` din `DashboardAuthContext`. Rută hub `/admin` folosește potrivire activă **exactă** (subpaginile nu o evidențiază).

## Reguli

- Orice split, lățimi extra, hover și densitate sunt **strict desktop**; verifică întotdeauna sub `md`.
- Păstrează token-urile semantice și componentele existente (`AppShell`, `PageHeader`, badge-uri, carduri).
