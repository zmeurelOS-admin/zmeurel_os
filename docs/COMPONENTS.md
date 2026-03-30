# COMPONENTS.md — Componente Zmeurel OS
_Last updated: 2026-03-30 (UI System update)_

---

## Convenții

- Toate componentele client folosesc `'use client'`
- Textul UI este în română
- Formulare: `react-hook-form` + shadcn `<Form>`
- Toasts: `sonner` (via `toast.success` / `toast.error`)
- Design tokens: `--agri-primary`, `--agri-border`, `--agri-bg`, `--agri-surface-muted`

## UI Design System

### Shadow System
Cardurile folosesc umbre calde multi-layer în loc de border-uri:
- `shadow-sm`: "0 1px 2px rgba(120,100,70,0.04), 0 4px 12px rgba(120,100,70,0.06)"
- `shadow-md`: "0 2px 4px rgba(120,100,70,0.05), 0 8px 24px rgba(120,100,70,0.08)"
- `shadow-glow` (FAB): "0 4px 20px rgba(13,155,92,0.2), 0 1px 3px rgba(13,155,92,0.15)"
- Cardurile NU au border - adâncimea vine din umbre
- Ton umbre: warm (120,100,70), nu rece (0,0,0)

### Press States
Toate elementele interactive au:
- `transform: scale(0.985)` la press
- Shadow redus la press
- `transition: 0.15s ease`

### Typography Weights
Se folosesc weights granulare:
- `750`: titluri principale (h1)
- `700`: valori numerice, titluri card
- `650`: labels secțiuni, meta bold
- `600`: titluri card
- `550`: labels intermediare
- `500`: subtitle
- `450`: body, meta
- `400`: text secundar

### Icon Containers
Wrapper-ul icon din MobileEntityCard:
- Background: gradient subtil "linear-gradient(135deg, #F8F7F5, #F0EFEC)"
- Inner shadow: "inset 0 1px 2px rgba(0,0,0,0.04)"
- Size: 42x42px, border-radius: 12px

### Spacing
Generous spacing system:
- Gap între secțiuni: 28px
- Padding card normal: 18px
- Padding card compact: 14px
- Border-radius card: 22px (era 16px)
- Border-radius elemente mici: 12px

### Status Badges
Au acum border + background:
- `success`: bg rgba(13,155,92,0.06), border rgba(13,155,92,0.1), color #0D9B5C
- `warning`: bg rgba(179,90,0,0.06), border rgba(179,90,0,0.1), color #B35A00
- `danger`: bg rgba(207,34,46,0.05), border rgba(207,34,46,0.1), color #CF222E
- `neutral`: bg #F0EfEC, color #94A0B0

### Secțiune Labels
Stil actualizat:
- fontSize: 14px, fontWeight: 700, color: ink (nu muted)
- letterSpacing: -0.2
- Counter badge opțional lângă label

### Glass
Rămâne strict limitat la bottom nav + FAB:
- Bottom nav: rgba(255,255,255,0.72), blur(24px), border-top rgba(255,255,255,0.5)
- FAB: rgba(13,155,92,0.92), blur(12px), border rgba(255,255,255,0.18)

### Color Palette
Actualizată:
- `bg`: #F6F5F2 (era #F4F4F2)
- `ink` (text principal): #0C0F13
- `sub` (text secundar): #4A5261
- `muted`: #94A0B0
- `faint` (chevron, separatori): #C4CCD8
- `green`: #0D9B5C
- `red`: #CF222E
- `orange`: #B35A00
- `blue`: #1868DB

### Mobile-First Principles
- No glass pe carduri (doar bottom nav + FAB)
- Opinionated `MobileEntityCard` - layout fix, props controlate
- Responsive breakpoints: mobile-first, desktop enhancement
- Touch-friendly tap targets (min 44px)
- Generous spacing for thumb navigation

---

## Layout & Shell

### `AppShell`
**Fișier:** `src/components/app/AppShell.tsx`
**Descriere:** Wrapper principal de layout — header sticky + zona de conținut scrollabilă + FAB.
**Props:**
```ts
{
  header: ReactNode      // PageHeader sau alt element
  children: ReactNode    // conținut pagină
}
```
**Utilizat în:** Toate paginile dashboard (via page.tsx sau *PageClient.tsx)

---

### `PageHeader`
**Fișier:** `src/components/app/PageHeader.tsx`
**Descriere:** Header de pagină cu titlu, subtitlu opțional și slot acțiuni dreapta.
**Props:** (verifică exact în fișier — probabil `title`, `subtitle?`, `actions?`)
**Utilizat în:** Toate paginile dashboard

---

### `TopBar`
**Fișier:** `src/components/app/TopBar.tsx`
**Descriere:** Bara de navigare superioară (logo, meniu profil, notificări).
**Utilizat în:** `src/app/(dashboard)/layout.tsx`

---

### `BottomTabBar`
**Fișier:** `src/components/app/BottomTabBar.tsx`
**Descriere:** Bottom tab bar activ pentru dashboard pe mobil (`md:hidden`). Include tab-urile principale și trigger pentru meniul „Mai mult”.
**Utilizat în:** `src/app/(dashboard)/layout.tsx`

---

### ~~`MobileBottomNav`~~ [ȘTERS]
**Fișier:** ~~`src/components/mobile/MobileBottomNav.tsx`~~ — fișier șters
**Motivul ștergerii:** Înlocuit complet de `BottomTabBar`. Dead code — nu mai era importat în niciun loc activ.

---

### ~~`MobileShell`~~ [ȘTERS]
**Fișier:** ~~`src/components/mobile/MobileShell.tsx`~~ — fișier șters
**Motivul ștergerii:** Wrapper mobil neutilizat. Dead code.

---

### `Sidebar`
**Fișier:** `src/components/layout/Sidebar.tsx`
**Descriere:** Sidebar desktop (`hidden md:flex`) cu navigare completă, grupată pe module, collapsible pe grupuri, state salvat în `localStorage` și overlay AI dedicat în footer.
**Utilizat în:** `src/app/(dashboard)/layout.tsx`

---

### `CompactPageHeader`
**Fișier:** `src/components/layout/CompactPageHeader.tsx`
**Descriere:** Header compact separat, folosit în layout-uri/pagini care nu randau header-ul complet standard.

---

## Contexte & Providers

### `DashboardAuthContext`
**Fișier:** `src/components/app/DashboardAuthContext.tsx`
**Descriere:** Context care furnizează identitatea utilizatorului autentificat (citit din headerele injectate de middleware).
**Valoare context:**
```ts
{
  userId: string
  email: string
  isSuperAdmin: boolean
}
```
**Hook de acces:** `useDashboardAuth()`
**Furnizat de:** `src/app/(dashboard)/layout.tsx`
**Utilizat în:** `UserProfileMenu`, `AdminTenantsPlanTable`, `LogoutButton`, pagini admin

---

### `AddActionContext`
**Fișier:** `src/contexts/AddActionContext.tsx`
**Descriere:** Context pentru înregistrarea acțiunii FAB (butonul ➕ flotant) per pagină.
**Valoare context:**
```ts
{
  action: (() => void) | null
  setAction: (fn: (() => void) | null) => void
}
```
**Hook de acces:** `useAddAction()`
**Furnizat de:** `src/app/providers.tsx`

---

### `DensityProvider`
**Fișier:** `src/components/app/DensityProvider.tsx`
**Descriere:** Context densitate UI (compact vs comfortable).
**Hook de acces:** `useUiDensity()` din `src/hooks/useUiDensity.ts`

---

## Carduri & KPI

### `KpiCard`
**Fișier:** `src/components/app/KpiCard.tsx`
**Descriere:** Card KPI standard cu icon, label, valoare numerică și trend opțional.
**Props:**
```ts
{
  icon?: ReactNode
  label: string
  value: string | number
  trend?: { value: number; direction: 'up' | 'down' }
  className?: string
}
```
**Utilizat în:** `DashboardHome`, pagini module

---

### `BaseCard`
**Fișier:** `src/components/app/BaseCard.tsx`
**Descriere:** Card de bază cu border agri și padding consistent.
**Utilizat în:** Bază pentru alte carduri

---

### `CompactListCard`
**Fișier:** `src/components/app/CompactListCard.tsx`
**Descriere:** Card compact pentru liste de elemente.

---

### `DashboardCard`
**Fișier:** `src/components/dashboard/DashboardCard.tsx`
**Descriere:** Card dashboard cu stil specific.

---

### `MobileEntityCard`
**Fișier:** `src/components/mobile/MobileEntityCard.tsx`
**Descriere:** Card mobil standardizat și opininat pentru entități scanabile rapid. Impune layout fix cu icon stânga, title/subtitle central, zonă summary dreapta (`mainValue`, `secondaryValue`, `statusLabel`) plus `meta` și `footer` opționale. Nu acceptă `children` sau `className` pentru container, iar variațiile sunt controlate doar prin `variant`, `density`, `interactive`, `showChevron` și `statusTone`.
**Props:**
```ts
{
  title: string
  subtitle?: string
  icon?: ReactNode
  mainValue?: string
  secondaryValue?: string
  meta?: string
  footer?: string
  statusLabel?: string
  statusTone?: 'neutral' | 'success' | 'warning' | 'danger'
  variant?: 'default' | 'highlight' | 'muted'
  density?: 'compact' | 'normal'
  interactive?: boolean
  showChevron?: boolean
  onClick?: () => void
  ariaLabel?: string
}
```
**Exemple:** `src/components/mobile/MobileEntityCard.examples.tsx`
**Utilizare recomandată:** Bază vizuală pentru liste/carduri mobile în Activități, Recoltări, Comenzi, Clienți, Culegători, Terenuri, Cheltuieli și alte module noi sau refăcute incremental.

---

### `ProfitSummaryCard`
**Fișier:** `src/components/app/ProfitSummaryCard.tsx`
**Descriere:** Card sumar profit (recoltări - cheltuieli).
**Utilizat în:** Rapoarte, Dashboard

---

## Dialogs & Formulare

### `form-dialog-layout`
**Fișier:** `src/components/ui/form-dialog-layout.tsx`
**Descriere:** ⭐ Wrapper standard pentru toate dialogurile cu formulare. Conține titlu, descriere opțională, conținut formular și butoane Submit/Cancel.
**Props:**
```ts
{
  title: string
  description?: string
  children: ReactNode         // câmpurile formularului
  onSubmit: () => void
  onCancel: () => void
  isLoading?: boolean
  submitLabel?: string        // default: "Salvează"
  cancelLabel?: string        // default: "Anulează"
}
```
**Utilizat în:** Toate dialogurile Add/Edit din aplicație

---

### `AppDialog`
**Fișier:** `src/components/app/AppDialog.tsx`
**Descriere:** Dialog generic refolosibil (wrapper peste shadcn Dialog).
**Props:** `open`, `onOpenChange`, `children`

---

### `AiBottomSheet`
**Fișier:** `src/components/ai/AiBottomSheet.tsx`
**Descriere:** Widgetul AI principal în format bottom sheet. Gestionează chat-ul, voice input, count usage, `open_form` handoff și confirmări directe pentru flow-urile suportate. Primește și varianta `panel` pentru desktop overlay.
**Utilizat în:** shell/dashboard via `AiFab` și `AiPanel`

---

### `AiPanel`
**Fișier:** `src/components/ai/AiPanel.tsx`
**Descriere:** Overlay fix în dreapta pentru desktop, deschis din sidebar și alimentat de același conținut ca dialogul AI mobil.
**Utilizat în:** `src/app/(dashboard)/layout.tsx`

---

### `MoreMenu` / `MoreMenuDrawer`
**Fișiere:** `src/components/app/MoreMenu.tsx`, `src/components/app/MoreMenuDrawer.tsx`
**Descriere:** Conținut + container drawer pentru meniul mobil „Mai mult”.
**Utilizat în:** `BottomTabBar`

---

### `ConfirmDeleteDialog`
**Fișier:** `src/components/app/ConfirmDeleteDialog.tsx`
**Descriere:** Dialog confirmare ștergere cu AlertDialog shadcn. Buton "Șterge" destructive.
**Props:**
```ts
{
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  onConfirm: () => void
  isLoading?: boolean
}
```
**Utilizat în:** Toți handlerii de ștergere

---

## Stări UI

### `EmptyState`
**Fișiere:** `src/components/app/EmptyState.tsx`, `src/components/ui/EmptyState.tsx`
**Descriere:** Mesaj stare goală cu icon și text descriere.

---

### `ErrorState`
**Fișier:** `src/components/app/ErrorState.tsx`
**Descriere:** Mesaj eroare cu retry opțional.

---

### `LoadingState`
**Fișier:** `src/components/app/LoadingState.tsx`
**Descriere:** Indicator loading (spinner/skeleton).

---

### `ListSkeleton`
**Fișier:** `src/components/app/ListSkeleton.tsx`
**Descriere:** Skeleton pentru liste de carduri.

---

### `ModuleSkeletons`
**Fișier:** `src/components/app/ModuleSkeletons.tsx`
**Descriere:** Skeletons specifice fiecărui modul.

---

### `AlertCard`
**Fișiere:** `src/components/app/AlertCard.tsx`, `src/components/ui/AlertCard.tsx`
**Descriere:** Card alertă cu dismiss (folosit pentru notificări importante).
**Notă:** Nu există `<Alert>` shadcn standard — se folosește `AlertCard` sau `alert-dialog`

---

## Badge-uri & Status

### `StatusBadge`
**Fișier:** `src/components/ui/StatusBadge.tsx`
**Descriere:** Badge status cu culoare configurabilă.
**Props:** `status: string`, `variant?`
**Utilizat în:** Carduri vânzări, comenzi, culegători

---

### `StatusChip`
**Fișier:** `src/components/app/StatusChip.tsx`
**Descriere:** Chip status (varianta mai mică).

---

### `TrendBadge`
**Fișier:** `src/components/ui/TrendBadge.tsx`
**Descriere:** Badge trend cu săgeată ↑↓ și culoare verde/roșu.

---

### `SyncBadge`
**Fișier:** `src/components/app/SyncBadge.tsx`
**Descriere:** Badge status sincronizare (pending/synced/failed).

---

## Lib Helpers

### `pause-helpers`
**Fișier:** `src/lib/pause-helpers.ts`
**Descriere:** Wrappere peste `computeActivityRemainingDays` din `src/lib/parcele/pauza.ts`.
**Funcții exportate:**
```ts
isPauseActive(activity, today?): boolean
getPauseRemainingDays(activity, today?): number
getPauseUrgency(activity, today?): 'urgent' | 'active' | 'none'
// urgent = 1-2 zile rămase (portocaliu), active = >2 zile (roșu), none = expirat
```
**Utilizat în:** `ActivityDetailSheet`, `/activitati-agricole/page.tsx`, `/parcele/[id]/page.tsx`

---

## UI Primitives

### `Sheet` / `SheetContent` / `SheetHeader` / `SheetFooter` / `SheetTitle`
**Fișier:** `src/components/ui/sheet.tsx`
**Descriere:** Bottom Sheet construit pe `@radix-ui/react-dialog`. Variante `side`: `bottom | top | left | right`. Bottom variant: `fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-white shadow-lg max-h-[90svh] overflow-y-auto`. Buton X built-in via `SheetClose`. Animații slide-in/slide-out.
**Exporturi:** `Sheet`, `SheetTrigger`, `SheetClose`, `SheetPortal`, `SheetOverlay`, `SheetContent`, `SheetHeader`, `SheetFooter`, `SheetTitle`, `SheetDescription`
**Utilizat în:** `ActivityDetailSheet`

---

## Module: Activități Agricole

### `ActivityDetailSheet`
**Fișier:** `src/components/activitati-agricole/ActivityDetailSheet.tsx`
**Descriere:** Sheet bottom care afișează toate detaliile unei activități agricole. La top: banner pauză activă (portocaliu urgent / roșu active). Conținut: `DetailRow`-uri cu toate câmpurile. Footer: buton "Șterge" (AlertDialog confirmare + `deleteMutation`) și "Editează" (deschide lazy `EditActivitateAgricolaDialog`). Invalidare cache pe `queryKeys.activitati` + `queryKeys.activitatiByParcela(parcela_id)`.
**Props:**
```ts
{
  activitate: ActivitateAgricola | null
  parcelaName?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted?: () => void
}
```
**Utilizat în:** `src/app/(dashboard)/parcele/[id]/page.tsx`

---

### Pagina Activități Agricole — `/activitati-agricole/page.tsx`
**Fișier:** `src/app/(dashboard)/activitati-agricole/page.tsx`
**Descriere:** Implementarea reală completă a paginii (nu `ActivitatiAgricolePageClient.tsx` care este cod mort). Renderează carduri inline (nu folosește `ActivitateAgricolaCard`). Cardurile sunt expandabile — secțiunea expandată conține:
- **✏️ Editează** — fond `yellowLight`, deschide `LazyEditActivitateAgricolaDialog` cu activitate pre-populată
- **🗑️ Șterge** — fond `coralLight`, deschide `LazyConfirmDeleteDialog` cu mutație DELETE + invalidare cache

Dialogurile sunt lazy-loaded (`next/dynamic`) și montate condiționat via `hasMountedEditDialog` / `hasMountedDeleteDialog` state. Funcțiile `openEditDialog(activitate)` și `openDeleteDialog(activitate)` gestionează tranziția de state.

---

### `ActivitateAgricolaCard`
**Fișier:** `src/components/activitati-agricole/ActivitateAgricolaCard.tsx`
**Descriere:** Card activitate agricolă cu tip, produs, dată și calcul pauze recoltare.
**Notă:** NU este folosit în `/activitati-agricole/page.tsx` — aceasta renderează carduri inline proprii.

---

### `ConfirmDeleteActivitateDialog`
**Fișier:** `src/components/activitati-agricole/ConfirmDeleteActivitateDialog.tsx`
**Descriere:** Dialog confirmare ștergere activitate.
**Utilizat în:** `ActivitateAgricolaCard`

---

## Module: Parcele

### `ParcelaCard`
**Fișier:** `src/components/parcele/ParcelaCard.tsx`
**Descriere:** Card parcelă cu `CompactListCard` (edit/delete via ActionIcons) + secțiune "Acțiuni rapide" expand/collapse cu butoane inline pentru adăugare activitate/recoltare.
**Props:**
```ts
{
  parcela: Parcela
  onEdit: () => void
  onDelete: () => void
  onAddActivitate?: () => void
  onAddRecoltare?: () => void
}
```
**Notă:** Neutilizat în pagina principală — aceasta folosește `ParceleList` + `ParcelePageClient` din `src/components/parcele/`.

---

### Pagina detalii teren — `/parcele/[id]/page.tsx`
**Fișier:** `src/app/(dashboard)/parcele/[id]/page.tsx`
**Descriere:** Pagina de detalii pentru un teren individual. Secțiunea de info principală conține titlu + badges + statistici, urmată de un **rând orizontal de butoane compacte** (icon + label) sub un border-top:
- **Editează** — `Pencil` icon, fond amber
- **Activitate** — `Leaf` icon, fond emerald (deschide AddActivitateAgricolaDialog cu parcela pre-selectată)
- **Recoltare** — `ShoppingBasket` icon, fond sky (deschide AddRecoltareDialog cu parcela pre-selectată)
- **Cultură** — `Plus` icon, fond violet (doar pentru solarii; deschide AddCulturaDialog)

Rândul de KPI-uri de sub info conține: Ultima recoltare, Producție sezon, Climat (solar), Stadiu (solar), Culturi active (solar). **Cardul "Ultima activitate" a fost eliminat** — info-ul este deja prezent în secțiunea "Activități recente" de mai jos.

---

### `ParceleList`
**Fișier:** `src/components/parcele/ParceleList.tsx`
**Descriere:** Lista de terenuri expandabilă cu carduri inline. Secțiunea expandată conține un **singur rând de butoane compacte** (icon + label scurt, min-h-44px): Detalii (Eye, opțional), Editează (Pencil), Activitate (Leaf), Recoltare (ShoppingBasket), Șterge (Trash2, opțional). Butoanele folosesc `flex-1` pentru a ocupa uniform spațiul pe un rând.
**Props:**
```ts
{
  parcele: Parcela[]
  onEdit: (parcela: Parcela) => void
  onDelete?: (parcela: Parcela) => void
  onOpen?: (parcela: Parcela) => void
  onAddActivity: (parcela: Parcela) => void
  onAddHarvest: (parcela: Parcela) => void
  parcelInsights?: Record<string, ParcelInsight>
  focusParcelId?: string | null
}
```
**Utilizat în:** `ParcelePageClient` (din `src/components/parcele/`)

---

### `AddParcelaDialog`
**Fișier:** `src/components/parcele/AddParcelaDialog.tsx`
**Descriere:** Dialog creare parcelă nouă cu formular complet (react-hook-form).
**Props:** `open`, `onOpenChange`
**Utilizat în:** `ParcelaPageClient`

---

### `AddCulturaDialog`
**Fișier:** `src/components/parcele/AddCulturaDialog.tsx`
**Descriere:** Dialog pentru adăugarea unei culturi pe solar/parcela curentă.
**Utilizat în:** `/parcele/[id]/page.tsx`

---

### `EditCulturaDialog`
**Fișier:** `src/components/parcele/EditCulturaDialog.tsx`
**Descriere:** Dialog editare cultură existentă.

---

### `DesfiinteazaCulturaDialog`
**Fișier:** `src/components/parcele/DesfiinteazaCulturaDialog.tsx`
**Descriere:** Dialog închidere/desființare cultură și actualizare stare.

---

### `DeleteConfirmDialog` (parcele)
**Fișier:** `src/components/parcele/DeleteConfirmDialog.tsx`
**Descriere:** Dialog confirmare ștergere parcelă. Există dar nu e conectat la UI (bug #1).

---

### `ParcelaForm`
**Fișier:** `src/components/parcele/ParcelaForm.tsx`
**Descriere:** Câmpuri formular parcelă (refolosibil în Add/Edit).

---

### `ParceleLayout`
**Fișier:** `src/components/parcele/ParceleLayout.tsx`
**Descriere:** Wrapper layout pentru pagina parcele.

---

### `StickyActionBar` (parcele)
**Fișier:** `src/components/parcele/StickyActionBar.tsx`
**Descriere:** Bară acțiuni sticky cu buton "Adaugă parcelă".

---

## Module: Recoltări

### `ViewRecoltareDialog`
**Fișier:** `src/components/recoltari/ViewRecoltareDialog.tsx`
**Descriere:** Dialog read-only cu detalii complete recoltare (kg cal1, kg cal2, culegător, parcelă).
**Utilizat în:** `RecoltariPageClient`

---

## Module: Clienți

### `AddClientDialog`
**Fișier:** `src/components/clienti/AddClientDialog.tsx`
**Descriere:** Dialog creare client nou.
**Utilizat în:** `ClientPageClient`

---

### `EditClientDialog`
**Fișier:** `src/components/clienti/EditClientDialog.tsx`
**Descriere:** Dialog editare client existent.

---

### `ClientDetailsDrawer`
**Fișier:** `src/components/clienti/ClientDetailsDrawer.tsx`
**Descriere:** Drawer lateral cu toate detaliile clientului + comenzi/vânzări asociate + acțiuni rapide.
**Utilizat în:** `ClientPageClient`

---

### `ClientImportHelpDialog`
**Fișier:** `src/components/clienti/ClientImportHelpDialog.tsx`
**Descriere:** Dialog de ajutor pentru formatul corect al fișierelor de import clienți.

---

### `ClientImportPreviewPanel`
**Fișier:** `src/components/clienti/ClientImportPreviewPanel.tsx`
**Descriere:** Panou preview/mapare + validare înainte de importul final al clienților.

---

### `ClientImportResultDialog`
**Fișier:** `src/components/clienti/ClientImportResultDialog.tsx`
**Descriere:** Dialog cu rezultatele importului de clienți: create, duplicate, erori.

---

## Module: Comenzi

### `ComenziPageClient` — ComandaCard inline
**Fișier:** `src/app/(dashboard)/comenzi/ComenziPageClient.tsx`
**Descriere:** Renderează carduri inline `ComandaCard`. Layout card: flex row `[icon | text content]` urmat de stats grid și secțiunea expandată ca frați la nivel de card container (nu în interiorul div-ului `flex: 1`). Astfel stats grid-ul (CANTITATE / PREȚ / TOTAL / LIVRARE), butonul canDeliver și secțiunea expandată ocupă **lățimea completă a cardului**.

---

### `ViewComandaDialog`
**Fișier:** `src/components/comenzi/ViewComandaDialog.tsx`
**Descriere:** Dialog vizualizare detalii comandă cu status, livrare, plată.
**Utilizat în:** `ComenziPageClient`

---

## Module: Culegători

### `CulegatorCard`
**Fișier:** `src/components/culegatori/CulegatorCard.tsx`
**Descriere:** Card culegător cu nume, status activ, tarif/kg.

---

### `AddCulegatorDialog`
**Fișier:** `src/components/culegatori/AddCulegatorDialog.tsx`
**Descriere:** Dialog adăugare culegător nou.

---

### `EditCulegatorDialog`
**Fișier:** `src/components/culegatori/EditCulegatorDialog.tsx`
**Descriere:** Dialog editare culegător existent.

---

## Module: Admin

### `AdminTenantsPlanTable`
**Fișier:** `src/components/admin/AdminTenantsPlanTable.tsx`
**Descriere:** Tabel gestionare planuri tenants (superadmin only). Folosește `useDashboardAuth()`.
**Utilizat în:** `/admin/tenants`

---

### `BetaUsersContactTable`
**Fișier:** `src/components/admin/BetaUsersContactTable.tsx`
**Descriere:** Tabel contact beta useri (superadmin only). Coloane: Nume fermă, Email, Telefon, Data înregistrării, Ultima activitate, Acțiuni. Acțiuni: buton `Phone` (link `tel:`), buton `MessageCircle` (WhatsApp cu mesaj pre-encodat în română) dacă există telefon, sau badge gri "Fără telefon". Sortat descrescător după `last_activity_at`.
**Interface:**
```ts
export interface BetaUserContactRow {
  tenant_id: string; tenant_name: string; owner_email: string | null
  contact_phone: string | null; created_at: string | null; last_activity_at: string | null
}
```
**Utilizat în:** `src/app/(dashboard)/admin/page.tsx`

---

## Root Components

### `LogoutButton`
**Fișier:** `src/components/LogoutButton.tsx`
**Descriere:** Buton deconectare. Apelează `supabase.auth.signOut()` + `resetSupabaseInstance()` + `window.location.href = '/login'` (hard redirect pentru a evita cache).
**Utilizat în:** `UserProfileMenu`

---

### `Navbar`
**Fișier:** `src/components/Navbar.tsx`
**Descriere:** Navbar landing page marketing (logo + link-uri + CTA).
**Utilizat în:** `src/app/page.tsx` (landing)

---

### `Toaster`
**Fișier:** `src/components/Toaster.tsx`
**Descriere:** Provider toast Sonner. Configurat cu poziție și teme.
**Utilizat în:** `src/app/layout.tsx`

---

## UI Controls

### `NumericField`
**Fișier:** `src/components/app/NumericField.tsx`
**Descriere:** Input numeric cu formatare (separatori mii, decimale).
**Utilizat în:** Formulare cheltuieli, vânzări, recoltări

---

### `SearchField`
**Fișier:** `src/components/ui/SearchField.tsx`
**Descriere:** Input căutare cu icon de search.
**Utilizat în:** Pagini cu liste filtrabile

---

### `StickyActionButton`
**Fișier:** `src/components/mobile/StickyActionButton.tsx`
**Descriere:** FAB (Floating Action Button) verde care triggerează `AddActionContext`.
**Notă:** FAB-ul din `BottomTabBar` este acum ascuns pe rute `/admin/*` (fix #2 aplicat în `shouldHideCenterAction`).

---

### `AiFab`
**Fișier:** `src/components/ui/AiFab.tsx`
**Descriere:** FAB dedicat pentru deschiderea AI chat, cu tooltip de onboarding și integrare light/dark.

---

### `ManualAddFab`
**Fișier:** `src/components/ui/ManualAddFab.tsx`
**Descriere:** FAB separat pentru acțiunea manuală de adăugare contextuală.

---

### `HighVisibilityToggle`
**Fișier:** `src/components/app/HighVisibilityToggle.tsx`
**Descriere:** Toggle contrast ridicat pentru accesibilitate.

---

### `OnboardingModal`
**Fișier:** `src/components/app/OnboardingModal.tsx`
**Descriere:** Modal ce apare o singură dată pentru fiecare tenant nou (verifică localStorage key `zmeurel_onboarding_shown_{tenantId}`). Oferă câmp de telefon (validare român: 07xx, 10 cifre), buton "Da, sună-mă" (salvează în `tenants.contact_phone` via Supabase) și "Nu acum" (închide fără salvare).
**Utilizat în:** `src/app/(dashboard)/dashboard/page.tsx`

---

### `FeedbackBanner`
**Fișier:** `src/components/app/FeedbackBanner.tsx`
**Props:**
```ts
{
  tenantId?: string | null
}
```
**Descriere:** Banner verde subtil ce invită utilizatorul la sesiune de feedback WhatsApp. Vizibil dacă NU a dat dismiss (`zmeurel_feedback_banner_dismissed`) și NU a trimis telefon (`zmeurel_phone_submitted_{tenantId}`). Buton X salvează dismiss în localStorage permanent. Buton "Scrie pe WhatsApp →" deschide link WhatsApp în tab nou.
**Utilizat în:** `src/app/(dashboard)/dashboard/page.tsx`

---

### `FarmSwitcher`
**Fișier:** `src/components/app/FarmSwitcher.tsx`
**Descriere:** Selector fermă activă (pentru multi-farm).

---

## Monitoring & Performance

### `MonitoringInit`
**Fișier:** `src/components/app/MonitoringInit.tsx`
**Descriere:** Inițializare Sentry error tracking.

### `PageViewTracker`
**Fișier:** `src/components/app/PageViewTracker.tsx`
**Descriere:** Tracking automat vizualizări pagini pentru analytics.

### `ServiceWorkerRegister`
**Fișier:** `src/components/app/ServiceWorkerRegister.tsx`
**Descriere:** Înregistrare Service Worker pentru PWA offline.

### `NavigationPerfLogger`
**Fișier:** `src/components/app/NavigationPerfLogger.tsx`
**Descriere:** Logging performanță navigare (LCP, FCP, etc.).

### `RouteTransitionIndicator`
**Fișier:** `src/components/app/RouteTransitionIndicator.tsx`
**Descriere:** Indicator loading la tranziții de rute.

---

## Dashboard Components (detalii)

### `DashboardHome`
**Fișier:** `src/components/dashboard/DashboardHome.tsx`
**Descriere:** Componenta principală dashboard. Orchestrează toate KPI-urile, activitatea recentă și unitățile active.
**Utilizat în:** `src/app/(dashboard)/dashboard/page.tsx`

### `RecentActivityCard`
**Fișier:** `src/components/dashboard/RecentActivityCard.tsx`
**Descriere:** Card cu ultimele activități/recoltări/vânzări. Nefolosit — dashboard real este în `dashboard/page.tsx`.
**Notă:** `formatDateLabel()` în `dashboard/page.tsx` acum include anul (ex: "17 mar 2026") — fix #5 aplicat.

### `FinanciarAziCard`
**Fișier:** `src/components/dashboard/FinanciarAziCard.tsx`
**Descriere:** KPI financiar zilnic (vânzări - cheltuieli).

### `ProductieAziCard`
**Fișier:** `src/components/dashboard/ProductieAziCard.tsx`
**Descriere:** KPI producție zilnică (kg recoltate).

### `Sparkline`
**Fișiere:** `src/components/dashboard/Sparkline.tsx`, `src/components/ui/Sparkline.tsx`
**Descriere:** Grafic sparkline mini SVG pentru trends.

### `StatRow`
**Fișier:** `src/components/dashboard/StatRow.tsx`
**Descriere:** Rând statistic cu label și valoare.

### `WelcomeCard`
**Fișier:** `src/components/dashboard/WelcomeCard.tsx`
**Descriere:** Card bun venit cu numele fermei și data curentă.
