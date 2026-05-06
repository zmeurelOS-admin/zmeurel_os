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

- **Formulare modale**: `AppDialog`, `AppDrawer` și `FormDialogLayout` (`src/components/ui/form-dialog-layout.tsx`); `desktopFormWide` + `FormDialogSection` pentru varianta „foaie” pe desktop. Pentru formulare mai dense, `DesktopFormGrid` + `DesktopFormAside` adaugă un aside `md+` fără să schimbe fluxul mobil. `DesktopFormPanel` este wrapper-ul minim pentru secțiuni desktop: sub `md` rămâne transparent, iar de la `md+` adaugă card alb cald, border subtil și spacing coerent. `showCloseButton` se activează punctual pe formularele care au nevoie de affordance desktop explicit în colțul dreapta-sus.

## Modul de referință

- **`src/app/(dashboard)/comenzi/ComenziPageClient.tsx`** — pattern oficial: căutare desktop în `DesktopToolbar`, listă cu `ResponsiveDataView` (`skipDesktopDataFilter` + `hideDesktopSearchRow` când filtrarea e deja în page), inspector structurat pe secțiuni. **Formular Add/Edit comandă**: `desktopFormWide` + `showCloseButton`, `FormDialogSection`, `DesktopFormPanel`, `DesktopFormGrid` și `ComandaFormSummary` pe `md+`; căutarea clientului rămâne full-width, contact/livrare sunt grupate în aceeași secțiune, iar aside-ul din dreapta afișează rezumatul comenzii plus ghid static. Mobil: aceeași ordine de câmpuri, fără coloană laterală.
- **`src/app/(dashboard)/recoltari/RecoltariPageClient.tsx`** — al doilea modul care validează reutilizarea: același trio de primitive, totaluri relevante pe `DesktopToolbar` pe desktop, `StickyActionBar` doar pe mobil (`md:hidden`). **Add/Edit recoltare** (`AddRecoltareDialog`, `EditRecoltareDialog`): `desktopFormWide`, `showCloseButton`, `FormDialogSection`, `DesktopFormPanel`, `DesktopFormGrid` + `RecoltareFormSummary` `md+`; modalul este limitat la aproximativ 70–72rem, cu secțiuni „Context / Recoltare / Observații” pe stânga și rezumat live calm în dreapta. Calculele de kg/calități/tarif/plată rămân în dialog și sunt doar prezentate în aside. Pe mobil cardul „Rezumat plată” rămâne în flux (`md:hidden`).
- **`src/components/parcele/ParcelePageClient.tsx`** — pe lângă workspace-ul master–detail, **Add/Edit teren** (`AddParcelDrawer`, `EditParcelDialog`) folosesc același shell desktop: `desktopFormWide`, `showCloseButton`, `FormDialogSection`, `DesktopFormPanel`, `DesktopFormGrid` și `ParcelFormSummary` `md+`. `ParcelForm` rămâne sursa unică de câmpuri; pe desktop se reorganizează în secțiunile „Detalii teren / Locație / Vizibilitate și raportare”, iar pe mobil aside-ul dispare și fluxul rămâne vertical.
- **`src/app/(dashboard)/culegatori/CulegatorPageClient.tsx`** — tabel desktop + `DesktopSplitPane` / inspector; dialogul de detaliu rămâne doar sub `md`. **Add/Edit culegător** (`AddCulegatorDialog`, `EditCulegatorDialog`): `desktopFormWide`, `FormDialogSection`, `DesktopFormGrid` + aside `md+` (`CulegatorFormSummary`) cu previzualizare câmpuri; la edit include rezumat sezon/ultima recoltare din `workerStats` deja pe pagină, fără query în dialog; mobil fără coloană laterală.
- **`src/app/(dashboard)/vanzari/VanzariPageClient.tsx`** — **Add/Edit vânzare** (`AddVanzareDialog`, `EditVanzareDialog`): `desktopFormWide`, `FormDialogSection`, `DesktopFormGrid` + `VanzareFormSummary` pe `md+`; totalul live `kg × preț`, statusul și numărul de vânzări pe client rămân derivate din formular/lista deja încărcată prin prop `tenantVanzari`, fără fetch nou.
- **`src/app/(dashboard)/produse/ProdusePageClient.tsx`** — catalog intern: pe `md+` **DesktopToolbar** (căutare, filtre categorie/status, „Adaugă produs”), **ResponsiveDataView** tabel + **DesktopSplitPane** / **DesktopInspectorPanel** (detaliu, imagini, acțiuni); mobil: carduri `MobileEntityCard` + filtre pill, fără inspector. **Add/Edit** (`AddProdusDialog`, `EditProdusDialog`): `desktopFormWide`, `FormDialogSection`, `DesktopFormGrid` + `ProdusFormSummary` pe `md+`; logica de fotografii și payload rămâne în dialog, fără fetch nou.
- **`src/app/(dashboard)/cheltuieli/CheltuialaPageClient.tsx`** — registru financiar: `md:max-w-7xl`, toolbar desktop cu total RON + număr înregistrări în filtru, tabel existent + inspector; **Add/Edit**: același `AppDrawer` / `AppDialog` + `FormDialogLayout` cu `desktopFormWide`, secțiuni `FormDialogSection` și aside `md+` cu rezumat live (`CheltuialaFormSummary`); sub `md` lățimea și fluxul rămân compacte.
- **`src/app/(dashboard)/investitii/InvestitiiPageClient.tsx`** — simetric cu Cheltuieli pentru CAPEX: același split + toolbar + inspector, lățime `md:max-w-7xl`; Add/Edit folosesc `desktopFormWide`, `FormDialogSection` și `DesktopFormGrid` + aside `md+` cu rezumat live (`InvestitieFormSummary`).
- **`src/app/(dashboard)/stocuri/StocuriPageClient.tsx`** — pattern **filtre + tabel + inspector** pe desktop: grilă cu trei coloane (`md+`), filtre în stânga (sticky), tabel `ResponsiveDataView` în centru, `DesktopInspectorPanel` în dreapta; căutarea desktop e doar în `DesktopToolbar` (`skipDesktopDataFilter` + `hideDesktopSearchRow` pe listă); pe sub `md` rămâne fluxul vertical cu același card de filtre deasupra listei.
- **`src/components/parcele/ParcelePageClient.tsx`** — sursa canonică pentru modulul Parcele în Faza 1: pe desktop folosește split clar listă stânga + inspector dreapta (header parcelă + acțiuni `+ Activitate`/`Jurnal`/`Tratamente`/`Mai multe`) și taburi interne în inspector (`Prezentare`, `Jurnal`, `Tratamente`, `Microclimat`), iar mobilul păstrează fluxul existent cu `MobileEntityCard` expandabil — în secțiunea expandată se afișează acum și block-ul `Microclimat` cu date OpenWeather reale (variantă compactă), plus link „Vezi microclimat manual" către `/parcele/{id}` doar pentru solarii care au loguri manuale. Componenta `src/components/parcele/MicroclimatAutoCard.tsx` este folosită atât în inspector-ul desktop, cât și în cardul mobil expandat (DRY) și consumă tipul `MeteoAutoSummary` exportat din `ParcelePageClient`. Sursa coordonatelor meteo este `activeMeteoParcelaId = expandedId ?? desktopSelectedParcelaId ?? filteredParcele[0]?.id`, astfel încât selectarea unei parcele pe mobil refresh-uiește meteo. `useMeteo` se invocă o singură dată în parent. Fișierul `src/app/(dashboard)/parcele/ParcelaPageClient.tsx` rămâne doar fallback legacy marcat explicit `@deprecated`.
- **Setări** (`src/app/(dashboard)/settings/page.tsx`) — al doilea pattern desktop: *Settings Shell* cu nav lateral sticky (`DesktopSettingsNav`, doar `md+`) și conținut în dreapta; mobil: coloană unică, fără nav.

## Subpattern: filtre + tabel + inspector (Stocuri)

- Folosește o **grilă cu trei coloane** pe `md+` în loc de `DesktopSplitPane` (split-ul din primitive acoperă două coloane).
- **Stânga**: aceleași controale de filtru ca pe mobil, într-o coloană îngustă, `sticky` + scroll vertical dacă lista de filtre e lungă.
- **Centru**: tabel desktop din `ResponsiveDataView`; selecție rând + hover folosesc deja props `onDesktopRowClick` / `isDesktopRowSelected`.
- **Dreapta**: `DesktopInspectorPanel` cu sumar derivat din datele deja încărcate în pagină (fără query suplimentar obligatoriu).

## Formulare desktop (Add/Edit — pilot Cheltuieli)

- **Același** dialog și aceeași logică (React Hook Form, Zod, mutații); doar **prezentare** și lățime: prop `desktopFormWide` pe `AppDialog` / `AppDrawer`, iar modulul poate crește punctual `contentClassName` pentru un modal centrat mai lat.
- **Secțiuni + aside**: `FormDialogSection` pentru scanare, `DesktopFormPanel` pentru gruparea vizuală a câmpurilor doar pe `md+`, `DesktopFormGrid` pentru coloană principală + `DesktopFormAside` sticky doar pe `md+`; pe mobil aside-ul este ascuns și ordinea câmpurilor rămâne aceeași.
- **Extindere**: pattern-ul pilot pentru Cheltuieli este portat în Investiții, Culegători, Recoltări, Vânzări, Produse și acum Parcele; alte module pot reutiliza aceeași compoziție fără framework nou, păstrând datele din formular sau din cache-ul paginii.

## ResponsiveDataView

- `skipDesktopDataFilter`: evită dublarea filtrului când lista e deja filtrată în părinte.
- `hideDesktopSearchRow`: ascunde rândul intern de căutare desktop; părintele expune o singură sursă de căutare (ex. toolbar).

## Navigație desktop (Sidebar)

- Grupul **Fermă** include și **`/activitati-agricole`** (Activități agricole), aliniat cu bara de tab-uri mobilă care avea deja destinația; ordinea în grup: Parcele → Recoltări → Activități agricole → Culegători.
- **Superadmin**: grup separat **Administrare** (`md+`, `Sidebar.tsx`) cu `/admin`, `/admin/analytics`, `/admin/audit`; vizibil doar dacă `isSuperAdmin` din `DashboardAuthContext`. Rută hub `/admin` folosește potrivire activă **exactă** (subpaginile nu o evidențiază).

## Reguli

- Orice split, lățimi extra, hover și densitate sunt **strict desktop**; verifică întotdeauna sub `md`.
- Păstrează token-urile semantice și componentele existente (`AppShell`, `PageHeader`, badge-uri, carduri).
