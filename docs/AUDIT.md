# AUDIT.md — Zmeurel OS Full Application Audit
_Audit date: 2026-03-20_

---

## Summary Table

| Module | Missing CRUD | Empty States | Form Validation | Nav Inconsistency | Raw Data | Onboarding |
|--------|-------------|--------------|-----------------|-------------------|----------|------------|
| **Activități Agricole** | ✅ Complete | ✅ Has empty state | ⚠️ Partial | ✅ OK | ✅ OK | 🔵 Minor | ✅ Pause highlight (2026-03-20) |
| **Recoltări** | ✅ Complete | ✅ Has empty state | ✅ OK | ✅ `/recoltari/new` → redirect (2026-03-20) | ✅ OK | 🔵 Minor |
| **Vânzări** | ✅ Complete | ✅ Has empty state (guides to Comenzi) | ✅ OK | 🟡 Desktop detail panel no edit history | ✅ Badge added (2026-03-20) | 🔵 Minor |
| **Vânzări Butași** | ✅ Complete | ✅ Has empty state | 🟡 Status field unrestricted in add form | ✅ OK | ✅ OK | 🔵 Minor |
| **Comenzi** | ✅ Complete | ✅ Tab-specific empty states (2026-03-20) | ✅ Zod schema added (2026-03-20) | ✅ OK | ✅ OK | 🔵 Minor |
| **Cheltuieli** | ✅ Complete | ✅ Has empty state | ✅ Zod schema in dialogs | ✅ OK | ✅ OK | 🔵 Minor |
| **Investiții** | ✅ Complete | ✅ Has empty state | ✅ Zod schema in dialogs | ✅ OK | ✅ OK | 🔵 Minor |
| **Culegători** | ✅ Complete | ✅ Has empty state | ✅ Zod schema | ✅ OK | ✅ OK | 🔵 Minor |
| **Parcele** | ✅ Complete | ✅ Detail page empty states added (2026-03-20) | ✅ Zod schema | ✅ OK | ✅ OK | 🟡 | ✅ Activity Sheet + pause highlights (2026-03-20) |
| **Dashboard** | N/A | ✅ Handles empty gracefully | N/A | 🔵 Minor | ✅ OK | ✅ "Primii pași" added (2026-03-20) |
| **Settings** | N/A (config) | ✅ OK | 🟡 Password change no strength indicator | ✅ OK | ✅ OK | ✅ OK |
| **Onboarding/Start** | N/A | ✅ OK | 🟡 No email format validation on signup | ✅ OK | ✅ OK | 🟡 |
| **Clienți** | ✅ Complete | ✅ Has empty state | ✅ Zod schema | ✅ OK | ✅ OK | 🔵 Minor |
| **Stocuri** | Read-only | ✅ Has empty state with explanation (2026-03-20) | N/A | ✅ OK | ✅ OK | 🟡 |
| **Rapoarte** | Read-only | ✅ Has empty state | N/A | ✅ OK | ✅ OK | 🟡 |
| **Planuri** | N/A | N/A | N/A | ✅ OK | ✅ OK | N/A |

---

## Module: Activități Agricole
**Route:** `/activitati-agricole`
**Files:** `src/app/(dashboard)/activitati-agricole/page.tsx`, `src/components/activitati-agricole/AddActivitateAgricolaDialog.tsx`, `src/components/activitati-agricole/EditActivitateAgricolaDialog.tsx`

### Findings

**🔵 MINOR — Dead code file `ActivitatiAgricolePageClient.tsx`**
- `src/app/(dashboard)/activitati-agricole/ActivitatiAgricolePageClient.tsx` is dead code (static demo UI). No runtime impact but it pollutes the codebase and causes confusion — STRUCTURE.md explicitly warns about this.

**🔵 MINOR — `useTrackModuleView` fires `'activitati'` (no plural)**
- Module key used is `'activitati'` instead of `'activitati-agricole'`. Analytics will group under a different key than other modules. Not a user-facing bug but causes analytics inconsistency.

**🔵 MINOR — Typo in UI string**
- In the AlertCard for active pause treatment: `"pauză tratament pîn? "` — the `?` character appears to be a garbled Romanian diacritic `ă`. The string should read `"până la"`. Visible to users.
- File: `src/app/(dashboard)/activitati-agricole/page.tsx` line ~363: `label={\`Teren ${parcelaName} — pauză tratament pîn? ${formatDate(item.expiryDate)}\`}`

**🔵 MINOR — Onboarding: empty state present but FAB label unclear**
- The FAB registers with label `'Adauga activitate'` (no diacritic on "Adaugă"). Minor inconsistency.

**✅ Empty state** — shows `<EmptyState icon={<Calendar>} title="Nicio activitate încă">`.
**✅ CRUD** — Create (AddActivitateAgricolaDialog), Edit (EditActivitateAgricolaDialog), Delete (ConfirmDeleteDialog + scheduleDelete/undo) all connected.
**✅ Form validation** — `zodResolver` used in dialogs with `FormMessage` display.
**✅ Navigation** — all actions open dialogs inline; no rogue `router.push`.
**✅ Raw data** — dates formatted via `formatDate()` using `toLocaleDateString('ro-RO')`.

---

## Module: Recoltări
**Route:** `/recoltari`, `/recoltari/new`
**Files:** `src/app/(dashboard)/recoltari/RecoltariPageClient.tsx`, `src/app/(dashboard)/recoltari/new/page.tsx`, `src/components/recoltari/AddRecoltareDialog.tsx`, `src/components/recoltari/EditRecoltareDialog.tsx`

### Findings

**✅ RESOLVED (2026-03-20) — `/recoltari/new` converted to server-side redirect**
- `src/app/(dashboard)/recoltari/new/page.tsx` now does `redirect('/recoltari?addNew=true')`. `RecoltariPageClient` detects `?addNew=true` and auto-opens `AddRecoltareDialog`. The old full-page form with raw HTML elements is gone.

**🔵 MINOR — Filter state not persisted on navigation away**
- The `timeFilter` and parcel filter chips reset to `'sezon'` on every mount. Users lose context when navigating back from a detail view.

**✅ Empty states** — `<EmptyState>` for zero recoltari, and a separate message for "nu există recoltări pentru filtrele selectate".
**✅ CRUD** — Create (AddRecoltareDialog + new/page), Edit (EditRecoltareDialog), Delete (DeleteConfirmDialog with impact check + scheduleDelete/undo).
**✅ Form validation** — `zodResolver` with zod schema in both AddRecoltareDialog and EditRecoltareDialog.
**✅ Raw data** — dates formatted correctly.
**✅ Analytics tracking** — `useTrackModuleView('recoltari')` present.

---

## Module: Vânzări
**Route:** `/vanzari`
**Files:** `src/app/(dashboard)/vanzari/VanzariPageClient.tsx`, `src/components/vanzari/AddVanzareDialog.tsx`, `src/components/vanzari/EditVanzareDialog.tsx`, `src/components/vanzari/ViewVanzareDialog.tsx`

### Findings

**🟡 IMPORTANT — Desktop detail panel (`aside`) does not use the standard `ViewVanzareDialog`/form dialogs**
- On `lg:` (desktop), a custom `<aside>` panel renders inline detail fields without the full `ViewVanzareDialog`. While functional (it has the same core fields), editing from the aside goes through `setEditingVanzare` which opens `EditVanzareDialog` — that part is OK. The "Detalii vanzare" aside duplicates ViewVanzareDialog content as raw `<p>` elements without consistent styling.
- File: `src/app/(dashboard)/vanzari/VanzariPageClient.tsx` lines ~777–826.

**✅ RESOLVED (2026-03-20) — `status_plata` now displays as colored badge in desktop aside**
- Replaced raw string with colored `<span>` badge: `platit` → emerald, `restanta` → red, `avans` → amber, others → gray.
- File: `src/app/(dashboard)/vanzari/VanzariPageClient.tsx`

**🔵 MINOR — Empty state navigates to `/comenzi` via `router.push`**
- The empty state for vânzări shows a button "📦 Vezi comenzile" that calls `router.push('/comenzi')`. This is consistent with the UX (since vânzări come from comenzi), but represents a navigation-from-empty-state pattern not used elsewhere.
- Not a bug, but worth noting as a design decision.

**✅ CRUD** — Create (AddVanzareDialog), Edit (EditVanzareDialog), Delete (ConfirmDeleteDialog + scheduleDelete/undo), Mark paid (updateVanzare mutation).
**✅ Form validation** — `zodResolver` in dialogs.
**✅ Analytics** — `useTrackModuleView('vanzari')` present.

---

## Module: Vânzări Butași (Material Săditor)
**Route:** `/vanzari-butasi`
**Files:** `src/app/(dashboard)/vanzari-butasi/VanzariButasiPageClient.tsx`, `src/app/(dashboard)/vanzari-butasi/page.tsx`, `src/components/vanzari-butasi/AddVanzareButasiDialog.tsx`, `src/components/vanzari-butasi/EditVanzareButasiDialog.tsx`

### Findings

**🟡 IMPORTANT — `page.tsx` uses `getTenantId` (throws) instead of `getTenantIdOrNull`**
- The server component `src/app/(dashboard)/vanzari-butasi/page.tsx` calls `getTenantId(supabase)` directly (the throwing variant) instead of `getTenantIdOrNull`. Per project convention (CLAUDE.md), page server components must use `getTenantIdOrNull` to prevent errors from hitting the error boundary. This was identified as a previous bug (#4) but the fix only applied to a `throw` statement, not the original call.
- Need to verify current state of file.

**🔵 MINOR — `useTrackModuleView` not called**
- `VanzariButasiPageClient` does not call `useTrackModuleView`. Module views for `vanzari-butasi` are not tracked. All comparable modules (vanzari, recoltari, culegatori, etc.) track this.
- File: `src/app/(dashboard)/vanzari-butasi/VanzariButasiPageClient.tsx`

**🔵 MINOR — Summary filter applied via URL query params (router.push) rather than state**
- The `applyDashboardFilter` function calls `router.push(...)` to change `?view=` query params. This adds entries to the browser history for every filter click (selecting "Active", then "Toate" = 2 history entries). Other modules use `useState` for filters. The `?soi=` param is also pushed, meaning the user gets more history entries for filtering by soi.
- File: `src/app/(dashboard)/vanzari-butasi/VanzariButasiPageClient.tsx` line ~176.

**✅ CRUD** — Create, Edit, View, Delete all connected with lazy dialogs.
**✅ Empty state** — `<EmptyState>` with primary action button.
**✅ Form validation** — `zodResolver` in AddVanzareButasiDialog and EditVanzareButasiDialog.
**✅ Raw data** — dates formatted properly.

---

## Module: Comenzi (Orders)
**Route:** `/comenzi`
**Files:** `src/app/(dashboard)/comenzi/ComenziPageClient.tsx`, `src/components/comenzi/ViewComandaDialog.tsx`

### Findings

**✅ RESOLVED (2026-03-20) — Create/Edit comanda form now has Zod schema with inline field errors**
- `comandaSchema` added with Zod v4; `validateComandaForm` validates before submit; inline `<p className="text-xs text-red-600">` error messages under each invalid field; red border on invalid inputs.
- File: `src/app/(dashboard)/comenzi/ComenziPageClient.tsx`

**🟡 IMPORTANT — No dedicated Add/Edit dialog components for Comenzi**
- Unlike every other module, Comenzi does not have `AddComandaDialog`/`EditComandaDialog` components. The form is embedded directly inline in `ComenziPageClient.tsx` as a large in-page form conditionally rendered. This violates the standard pattern and makes the code very long (~700+ lines) and hard to maintain.
- `ViewComandaDialog` exists in `src/components/comenzi/` but it is read-only. There is no equivalent edit dialog.

**✅ RESOLVED (2026-03-20) — Empty states for "Livrate" and "Toate" tabs now show tab-specific messages**
- `title` and `description` differ per `activeTab` value: "Nicio comandă livrată" for `livrate`, "Nicio comandă înregistrată" for `toate`, default for active tab.

**🔵 MINOR — `useTrackModuleView` not called**
- `ComenziPageClient` does not call `useTrackModuleView`. Module views for `comenzi` are not tracked. Compare with recoltari, vanzari, culegatori, etc.
- File: `src/app/(dashboard)/comenzi/ComenziPageClient.tsx`

**🔵 MINOR — Comanda status shown as raw DB slug in some paths**
- Although a `statusLabelMap` and `statusVariantMap` are defined, the quick-status-change dropdown and some secondary text paths may briefly display the raw status value (`'noua'`, `'in_livrare'`) before the map lookup, depending on the render path. The card header uses `statusLabelMap[comanda.status]` correctly, so this is minor.

**✅ CRUD** — Create, Edit, Delete, Deliver (via RPC), Reopen (via RPC) all connected.
**✅ Raw dates** — `formatDate()` used throughout.

---

## Module: Cheltuieli
**Route:** `/cheltuieli`
**Files:** `src/app/(dashboard)/cheltuieli/CheltuialaPageClient.tsx`, `src/components/cheltuieli/AddCheltuialaDialog.tsx`, `src/components/cheltuieli/EditCheltuialaDialog.tsx`, `src/components/cheltuieli/ViewCheltuialaDialog.tsx`

### Findings

**🔵 MINOR — Cheltuieli create/edit dialogs use `zodResolver` but `suma_lei` validation does not enforce > 0**
- The schema in `AddCheltuialaDialog` may allow `suma_lei = 0` (need to verify exact constraint), but the UX doesn't provide a clear "amount must be positive" message until after submit. Minor.

**🔵 MINOR — `useTrackModuleView` not in the module-level declaration search results from `src/app/(dashboard)`**
- `CheltuialaPageClient.tsx` is at the component level and does call `useTrackModuleView('cheltuieli')` — confirmed present. No issue.

**✅ CRUD** — Complete: Add, Edit, View, Delete with scheduleDelete/undo.
**✅ Empty states** — `<EmptyState>` rendered when no cheltuieli.
**✅ Form validation** — `zodResolver` in both AddCheltuialaDialog and EditCheltuialaDialog.
**✅ Raw data** — dates formatted; amounts formatted with `Intl.NumberFormat`.
**✅ Analytics** — `useTrackModuleView('cheltuieli')` present.

---

## Module: Investiții
**Route:** `/investitii`
**Files:** `src/app/(dashboard)/investitii/InvestitiiPageClient.tsx`, `src/components/investitii/AddInvestitieDialog.tsx`, `src/components/investitii/EditInvestitieDialog.tsx`

### Findings

**🔵 MINOR — No `scheduleDelete` / undo pattern for investiții**
- Unlike Cheltuieli, Recoltari, Vanzari, Culegatori (all of which use a 5-second undo window via `scheduleDelete`), deleting an investiție calls `deleteMutation.mutate(id)` immediately after the confirm dialog. There is no undo opportunity. This is inconsistent with the rest of the app's delete UX.
- File: `src/app/(dashboard)/investitii/InvestitiiPageClient.tsx`

**✅ CRUD** — Add, Edit, Delete all connected.
**✅ Empty state** — `<EmptyState>` from `src/components/app/EmptyState.tsx` is rendered.
**✅ Form validation** — `zodResolver` in dialogs.
**✅ Analytics** — `useTrackModuleView('investitii')` present.

---

## Module: Culegători
**Route:** `/culegatori`
**Files:** `src/app/(dashboard)/culegatori/CulegatorPageClient.tsx`, `src/components/culegatori/AddCulegatorDialog.tsx`, `src/components/culegatori/EditCulegatorDialog.tsx`

### Findings

**🔵 MINOR — `tarif_lei_kg` is optional in zod schema**
- In `AddCulegatorDialog`, the schema has `tarif_lei_kg: z.string().optional()`. Since the tarif is used to compute manoperă automatically on every recoltare, a culegator without a tarif will silently produce recoltări with zero manoperă cost. There is no UI warning or required-field enforcement for tarif.
- File: `src/components/culegatori/AddCulegatorDialog.tsx` line ~19.

**🔵 MINOR — Delete does not check for active recoltări impact**
- The delete confirm dialog for culegători says "Ștergi culegătorul X?" with no impact information. For recoltari, the delete dialog shows how much stock would be removed. For culegatori, historical recoltari referencing a deleted culegator will have `culegator_id` becoming a dangling FK (unless DB has a SET NULL constraint). No pre-delete impact query is performed.

**✅ CRUD** — Add, Edit, Delete (with scheduleDelete/undo) all connected.
**✅ Empty state** — `<EmptyState icon={<UserPlus>}>`.
**✅ Form validation** — `zodResolver` in AddCulegatorDialog and EditCulegatorDialog.
**✅ Analytics** — `useTrackModuleView('culegatori')` present.
**✅ Raw data** — dates formatted.

---

## Module: Parcele (Fields/Plots)
**Route:** `/parcele`, `/parcele/[id]`
**Files:** `src/components/parcele/ParcelePageClient.tsx`, `src/app/(dashboard)/parcele/[id]/page.tsx`, `src/components/parcele/ParceleList.tsx`, `src/components/parcele/AddParcelDrawer.tsx`, `src/components/parcele/EditParcelDialog.tsx`

### Findings

**✅ RESOLVED (2026-03-20) — Detail page now shows empty states for activities and harvests**
- When `activitatiQuery.isFetched && activitati.length === 0`, renders centered empty state with `<Leaf>` icon and "+ Adaugă activitate" button. Same pattern for recoltari with `<ShoppingBasket>` icon.
- File: `src/app/(dashboard)/parcele/[id]/page.tsx`

**🟡 IMPORTANT — `SOIURI_DISPONIBILE` is hardcoded**
- Both `ParcelePageClient.tsx` and `/parcele/[id]/page.tsx` hardcode `const SOIURI_DISPONIBILE = ['Delniwa', 'Maravilla', 'Enrosadira', 'Husaria']`. This list is only relevant for berry varieties; solar/greenhouse users will see these inapplicable options in dropdowns. There is no dynamic lookup from the `crops`/`crop_varieties` tables.
- Files: `src/components/parcele/ParcelePageClient.tsx` line 57; `src/app/(dashboard)/parcele/[id]/page.tsx` line 50.

**🔵 MINOR — `ParcelaCard.tsx` and `ParcelaPageClient.tsx` at `src/app/(dashboard)/parcele/` are dead code**
- `src/app/(dashboard)/parcele/ParcelaPageClient.tsx` is explicitly listed in STRUCTURE.md as "NEUTILIZAT". The real implementation is `src/components/parcele/ParcelePageClient.tsx`. The duplicate file in `app/` causes confusion.

**🔵 MINOR — Parcel deletion does not handle case where parcel has linked records gracefully in all paths**
- `getParcelaDeleteImpact` is called and the result shown, but if the impact check fails (network error), the delete proceeds without warning. Minor edge case.

**✅ CRUD** — Full CRUD: Add (AddParcelDrawer), Edit (EditParcelDialog), Delete (ConfirmDeleteDialog with impact check + scheduleDelete/undo).
**✅ Form validation** — `zodResolver` in AddParcelDrawer, EditParcelDialog, ParcelForm.
**✅ Analytics** — `useTrackModuleView('parcele')` present.
**✅ Raw data** — dates formatted.

---

## Module: Dashboard
**Route:** `/dashboard`
**Files:** `src/app/(dashboard)/dashboard/page.tsx`

### Findings

**✅ RESOLVED (2026-03-20) — Dashboard now shows "Primii pași" getting-started section for new users**
- Added `showGettingStarted` condition (all counts = 0, not hidden). Renders 3 guided steps: MapPin → Adaugă primul teren, Leaf → Înregistrează o activitate, ShoppingBasket → Adaugă o recoltare. Displayed below `WelcomeCard` with green-tinted card styling.
- File: `src/app/(dashboard)/dashboard/page.tsx`

**🟡 IMPORTANT — `formatTimestamp` and `hasSparkline` are declared but suppressed with `void`**
- Two utility functions (`formatTimestamp`, `hasSparkline`) are defined at the top of dashboard/page.tsx and immediately followed by `void formatTimestamp` / `void hasSparkline`. These appear to be dead utility code from a previous iteration that was commented out. The `void formatMoney` is also present. This indicates partial refactoring.
- File: `src/app/(dashboard)/dashboard/page.tsx` lines ~94–96.

**🔵 MINOR — Dashboard `isLoading` state shows `<DashboardSkeleton>` with no timeout / error fallback**
- If all queries hang (no network), the skeleton persists indefinitely. No timeout-based empty state fallback. The `retry: 1` global setting would trigger after first failure, but the query failure UX for dashboard (beyond `<ErrorState>`) is not clearly communicated.

**✅ Empty states** — Individual KPI cards and sections handle zero gracefully (show `0` instead of crashing).
**✅ Raw data** — `formatDateLabel()` uses `Intl.DateTimeFormat` with day/month/year.
**✅ Analytics** — Not explicitly tracked with `useTrackModuleView` (dashboard is the root, acceptable).

---

## Module: Settings
**Route:** `/settings`
**Files:** `src/app/(dashboard)/settings/page.tsx`

### Findings

**🟡 IMPORTANT — Password change: no password strength indicator or confirmation mismatch shown inline**
- The password change form uses `useState` for `newPassword` and `confirmPassword`, compares them manually before submit, and shows a `toast.error()` if they don't match. There is no inline `<FormMessage>` showing the mismatch under the field, and no password strength indicator. A user who types a mismatching confirmation only learns about it after hitting "Salvează".
- File: `src/app/(dashboard)/settings/page.tsx`

**🔵 MINOR — Farm name save uses raw `supabase.from('tenants').update()` directly in the component**
- The farm name change is handled inline in the component with direct Supabase calls rather than a query function in `src/lib/supabase/queries/`. Inconsistent with the pattern but not broken.

**🔵 MINOR — Export CSV: `parcele` and `culegatori` tables are not included in the CSV module list**
- The `CSV_MODULES` array in `settings/page.tsx` exports: activitati, cheltuieli, vanzari, recoltari, clienti, comenzi. Missing: `parcele`, `culegatori`, `investitii`, `stocuri`. Users cannot download their parcele or culegatori data as CSV through the Settings UI.
- File: `src/app/(dashboard)/settings/page.tsx` lines ~48–55.

**✅ GDPR** — `GDPR_TABLES` list is comprehensive (includes all data tables).
**✅ Reset farm** — Two-step confirmation before farm reset.
**✅ Delete account** — Two-step with text confirmation (`STERGE`).

---

## Module: Onboarding / Start
**Route:** `/start`
**Files:** `src/app/(onboarding)/start/page.tsx`

### Findings

**🟡 IMPORTANT — No visible feedback when demo seed fails silently**
- The `handleStartDemo` flow calls the demo seed API and redirects to `/dashboard` on success. If the seed fails (API error), the user lands on an empty dashboard with no explanation. The error path sets `setErrorMessage(...)` but this only shows in the `/start` page — the redirect happens before the user sees it.
- File: `src/app/(onboarding)/start/page.tsx`

**🟡 IMPORTANT — Beta signup email validation not enforced client-side**
- The "Înregistrează-te" (beta signup) path does not have a visible email format validation message. The `<Input type="email">` relies on browser native validation, which is inconsistent across browsers and invisible on mobile when using certain input methods.

**🔵 MINOR — Google OAuth redirect on `/start` redirects authenticated users immediately**
- When a user is already authenticated, `redirectAuthenticatedUser` is set to `true` and the `useEffect` immediately calls `router.replace('/dashboard')`. This is correct behavior, but if the user intentionally navigated back to `/start` (e.g., to change demo type), they are bounced away without choice.

**✅ Farm-type selection** — Two-card selection (Fructe de pădure / Solarii) before demo creation.
**✅ Layout** — Clean onboarding layout without sidebar.

---

## Module: Clienți
**Route:** `/clienti`
**Files:** `src/app/(dashboard)/clienti/ClientPageClient.tsx`, `src/components/clienti/AddClientDialog.tsx`, `src/components/clienti/EditClientDialog.tsx`, `src/components/clienti/ClientDetailsDrawer.tsx`

### Findings

**🔵 MINOR — CSV import feature is complex and lacks step-by-step onboarding**
- The client module has a full CSV import pipeline (`ClientImportPreviewPanel`, `ClientImportHelpDialog`, `ClientImportResultDialog`). This is a power-user feature with no in-app tour or tooltip guidance. New users who discover the import button without any context may be confused.

**🔵 MINOR — `getTenantId` called in `ClientPageClient` (client component)**
- The component calls `getTenantId(getSupabase())` directly (the throwing variant) inside a mutation callback for bulk import. This is acceptable inside a mutation (mutations should throw if no tenant), but it bypasses the `getTenantIdOrNull` convention for any pre-flight checks. Minor pattern deviation.

**✅ CRUD** — Add (AddClientDialog), Edit (EditClientDialog), Delete (ConfirmDeleteDialog), View details (ClientDetailsDrawer).
**✅ Empty state** — `<EmptyState>` rendered when no clients.
**✅ Form validation** — `zodResolver` in AddClientDialog and EditClientDialog.
**✅ Analytics** — `useTrackModuleView('clienti')` present.

---

## Module: Stocuri (Inventory)
**Route:** `/stocuri`
**Files:** `src/app/(dashboard)/stocuri/StocuriPageClient.tsx`

### Findings

**✅ RESOLVED (2026-03-20) — Stocuri empty state now explains auto-population from harvests**
- `<EmptyState description="Stocul se completează automat din recoltări. Adaugă o recoltare pentru a vedea stocul disponibil.">` added.
- File: `src/app/(dashboard)/stocuri/StocuriPageClient.tsx`

**🔵 MINOR — `LOW_STOCK_THRESHOLD` is hardcoded at 20 kg**
- The low-stock threshold (20 kg) is hardcoded in `StocuriPageClient.tsx`. This is not configurable per tenant and may not be meaningful for different operation scales (a small farm vs. a large cooperative).

**✅ Empty state** — `<EmptyState>` renders when stocuriPeLocatie is empty.
**✅ Analytics** — `useTrackModuleView('stocuri')` present.
**✅ Filters** — Location, product, depozit, calitate filters all functional.
**✅ Read-only** — No mutations needed; stoc is managed atomically via RPCs in other modules.

---

## Module: Rapoarte
**Route:** `/rapoarte`
**Files:** `src/app/(dashboard)/rapoarte/RapoartePageClient.tsx`

### Findings

**🟡 IMPORTANT — `useTrackModuleView` not called**
- `RapoartePageClient` does not call `useTrackModuleView`. Module views for rapoarte are not tracked. This is notable since rapoarte is a key engagement module.
- File: `src/app/(dashboard)/rapoarte/RapoartePageClient.tsx`

**🔵 MINOR — Report data is fetched via props (passed from page.tsx) but `RapoartePageClient` appears to own its own query state**
- The client component imports all needed query functions and calls them internally. The `page.tsx` is thin (server component that renders the client). This is the correct pattern. No issue here.

**🔵 MINOR — `custom` period type in `PeriodType` not fully implemented**
- The `PeriodType` includes `'custom'` but inspection of the component suggests the date range picker for custom periods may not be fully wired up (the Input fields for custom date range exist but their state management needs verification).
- File: `src/app/(dashboard)/rapoarte/RapoartePageClient.tsx`

**✅ Empty state** — `<EmptyState>` rendered when no data for selected period.
**✅ Read-only** — Correct, rapoarte is analytics-only.

---

## Module: Planuri
**Route:** `/planuri`
**Files:** `src/app/(dashboard)/planuri/page.tsx`

### Findings

**🔴 CRITICAL — Entire module is a placeholder with no real functionality**
- The entire Planuri page renders a static text: "Toate functionalitățile sunt deblocate în beta" with a "Înapoi la dashboard" button. There is no actual subscription/plan management UI.
- This is acceptable for beta, but if this route is surfaced in the sidebar navigation, it creates a dead-end user experience. New users who navigate to "Planuri" expecting subscription info will find nothing useful.
- File: `src/app/(dashboard)/planuri/page.tsx`

**🔵 MINOR — The module still fires `useTrackModuleView('planuri')` on a placeholder page**
- Analytics will record views of this empty placeholder, inflating "planuri" module view counts in admin analytics without meaningful engagement.

---

## Cross-Cutting Issues

### ✅ RESOLVED (2026-03-20) — Admin: Tabel contact Beta useri

`BetaUsersContactTable` adăugat în `/admin`. Afișează toți tenants cu email, telefon, data înregistrării, ultima activitate și butoane de acțiune (telefon/WhatsApp). Sortat descrescător după ultima activitate.

---

### ✅ RESOLVED (2026-03-20) — Visual highlight pauze pesticide active

`src/lib/pause-helpers.ts` creat. Pauze active vizibile în 3 locuri:
1. `/activitati-agricole`: card border/bg urgency-based, badge "⏳ Pauză activă — X zile rămase"
2. `/parcele` (ParceleList): card border portocaliu/roșu, badge "🚫 Pauză X zile" lângă titlu
3. `/dashboard`: secțiune "⚠️ Atenție" cu AlertCard per parcelă afectată, deasupra "Unități active"

---

### ✅ RESOLVED (2026-03-20) — Activity detail Sheet pe pagina teren (`/parcele/[id]`)

`sheet.tsx` creat (Radix Dialog-based). `ActivityDetailSheet` creat cu detalii complete, banner pauză, Editează + Șterge. Tap pe card în `/parcele/[id]` deschide Sheet în loc de inline expand.

---

### ✅ RESOLVED (2026-03-20) — New user onboarding: "Primii pași" section added to dashboard

A 3-step getting-started section now displays on `/dashboard` when all core data counts are 0. Steps guide the user to: add a parcel → record an activity → add a harvest. Each step has a navigation button. The section disappears automatically once any data exists.

---

### 🟡 IMPORTANT — Analytics tracking gaps

The following modules do not call `useTrackModuleView`:
- `ComenziPageClient` — missing
- `VanzariButasiPageClient` — missing
- `RapoartePageClient` — missing

These represent significant user engagement paths that are invisible in admin analytics.

---

### 🟡 IMPORTANT — Inconsistent delete UX: some modules have undo, some don't

Modules **with** 5-second undo delete (scheduleDelete pattern):
- Activități Agricole, Recoltări, Vânzări, Vânzări Butași, Culegători, Cheltuieli, Parcele

Modules **without** undo delete:
- Investiții (immediate delete after ConfirmDialog)
- Clienți (need to verify)
- Comenzi (uses `deleteComanda` RPC directly)

---

### 🔵 MINOR — `src/app/(dashboard)/parcele/ParcelaPageClient.tsx` is a dead file

Listed in STRUCTURE.md as "NEUTILIZAT". The real implementation is in `src/components/parcele/ParcelePageClient.tsx`. The file in `app/` should be deleted to avoid confusion.
File: `src/app/(dashboard)/parcele/ParcelaPageClient.tsx`

---

### 🔵 MINOR — Toast messages have inconsistent diacritics/punctuation

Several toast messages lack Romanian diacritics:
- "Activitate stearsa" (should be "Activitate ștearsă")
- "Recoltare stearsa" (should be "Recoltare ștearsă")
- "Comanda stearsa" (should be "Comandă ștearsă")
- "Culegător șters" (correct — inconsistency between modules)
- "Investitie stearsa" (should be "Investiție ștearsă")

This inconsistency is present across multiple PageClient files.

---

## Severity Legend

| Symbol | Meaning |
|--------|---------|
| 🔴 | Critical — broken flow, data loss risk, or completely non-functional |
| 🟡 | Important — significant UX degradation, pattern violation, or missing feature |
| 🔵 | Minor — polish issue, inconsistency, or technical debt |
