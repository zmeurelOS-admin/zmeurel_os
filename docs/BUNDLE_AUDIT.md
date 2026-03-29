# BUNDLE_AUDIT

## Scope And Method

- Date: 2026-03-18
- Repo state: current local workspace
- Analyzer setup: `@next/bundle-analyzer` added as a conditional wrapper in `next.config.js`
- Build command used: `ANALYZE=true npm run build`
- Validation: analyzer build completed successfully on Next.js 16.1.6 with webpack

This report focuses on the client bundle, especially:

- shared chunks inherited by most authenticated routes
- dashboard-related routes
- mobile-critical routes
- unexpectedly heavy client-side libraries

## Overall Verdict

- Beta health: acceptable, but only narrowly for slower phones and weaker networks
- Main issue: shared/global client cost is heavier than route-local cost on most protected screens
- Biggest pattern: the app pays a large global tax for Sentry client instrumentation/replay, Next runtime/client internals, and browser Supabase auth/session support
- Dashboard finding: the dashboard's own route chunk is not the worst offender; first-load cost is dominated by shared client bundles

## 2026-03-18 Sentry Follow-Up

- Applied changes:
  - removed the static `@sentry/nextjs` import from both `instrumentation-client.ts` entry files
  - kept client error monitoring init, but reduced it to a minimal static `init(...)` path
  - moved route-transition capture behind a dynamic import
  - made Replay opt-in with `NEXT_PUBLIC_SENTRY_REPLAY_ENABLED=true`
  - when Replay is enabled, it is attached asynchronously after core init instead of being part of the critical bootstrap path
  - removed the root-layout monitoring path's static dependency on `src/lib/monitoring/sentry.ts` by using direct dynamic Sentry calls in `useSentryUser`

- Measured outcome:
  - shared `main` chunk dropped from about `389.2 KB parsed / 122.9 KB gzip` to about `134.6 KB parsed / 39.8 KB gzip`
  - estimated improvement: about `254.6 KB parsed` and `83.1 KB gzip` removed from the critical `main` path
  - the Replay chunk (`~119.2 KB parsed / 37.7 KB gzip`) no longer appears as an initial `main-app` dependency; it is now async only

- Important tradeoff:
  - core browser error reporting remains enabled
  - Replay is no longer always-on by default
  - router-transition instrumentation is still available, but it loads lazily instead of inflating the shared startup path

## 2026-03-18 Vânzări Butași Follow-Up

- Applied changes:
  - kept the page shell, KPIs, filters, search, and `VanzareButasiCard` eager
  - moved `AddVanzareButasiDialog`, `EditVanzareButasiDialog`, `ViewVanzareButasiDialog`, and `DeleteConfirmDialog` behind `next/dynamic`
  - only mount those secondary surfaces after first user intent
  - warm the relevant chunk on the exact action that opens each dialog

- Measured outcome:
  - `vanzari-butasi` route chunk dropped from about `96.2 KB parsed / 22.3 KB gzip` to about `45.3 KB parsed / 12.8 KB gzip`
  - estimated improvement: about `50.9 KB parsed` and `9.5 KB gzip` off the initial route-local bundle
  - the main deferred chunks now map roughly to:
    - Add dialog: `18.0 KB parsed / 5.2 KB gzip`
    - Edit dialog: `14.8 KB parsed / 4.3 KB gzip`
    - View dialog: `10.0 KB parsed / 2.7 KB gzip`
    - Delete confirm remains a small async chunk around `2.3 KB parsed / 1.0 KB gzip`

- Important tradeoff:
  - first open of add/edit/view can pay a small async load cost
  - this is intentional because those flows are secondary compared with the initial orders list view

## 2026-03-18 CRUD Route Follow-Up

- Applied changes:
  - kept the main shell, KPI blocks, search, filters, and primary list/cards eager on `/cheltuieli`, `/activitati-agricole`, and `/clienti`
  - moved add/edit/view/delete secondary surfaces behind `next/dynamic`
  - only mount those dialogs or drawers after first user intent
  - warmed the relevant chunk on the same action that opens each surface

- Measured outcome:
  - `cheltuieli` route chunk dropped from about `59.0 KB parsed / 16.2 KB gzip` to about `44.7 KB parsed / 13.6 KB gzip`
  - estimated improvement: about `14.3 KB parsed` and `2.6 KB gzip`
  - deferred secondary chunks now map roughly to:
    - Add dialog: `9.5 KB parsed / 3.4 KB gzip`
    - Edit dialog: `8.1 KB parsed / 2.9 KB gzip`
    - View dialog: `5.2 KB parsed / 1.5 KB gzip`
    - Delete confirm: `2.3 KB parsed / 1.0 KB gzip`
  - `activitati-agricole` route chunk dropped from about `53.8 KB parsed / 14.6 KB gzip` to about `39.0 KB parsed / 11.8 KB gzip`
  - estimated improvement: about `14.8 KB parsed` and `2.8 KB gzip`
  - deferred secondary chunks now map roughly to:
    - Add dialog: `12.6 KB parsed / 4.3 KB gzip`
    - Edit dialog: `11.7 KB parsed / 3.9 KB gzip`
    - Delete confirm: `2.3 KB parsed / 1.0 KB gzip`
  - `clienti` route chunk dropped from about `51.2 KB parsed / 13.9 KB gzip` to about `44.0 KB parsed / 13.1 KB gzip`
  - estimated improvement: about `7.2 KB parsed` and `0.8 KB gzip`
  - deferred secondary chunks now map roughly to:
    - Add dialog: `8.7 KB parsed / 3.0 KB gzip`
    - Edit dialog: `7.4 KB parsed / 2.6 KB gzip`
    - Details drawer: `7.9 KB parsed / 2.5 KB gzip`
    - Delete confirm: `2.3 KB parsed / 1.0 KB gzip`

- Important tradeoff:
  - the first open of secondary CRUD surfaces now pays a small async load cost
  - this is an intentional trade to keep the initial browsing/list experience lighter on mobile

## 2026-03-18 Clienți Second Pass

- Applied changes:
  - kept the list/cards/table, KPIs, search, filters, and tuned create/edit/details/delete surfaces as they were
  - moved the remaining secondary import workflow UI out of the initial `/clienti` chunk:
    - import preview panel
    - import help dialog
    - import result dialog
  - warmed those async chunks on import/help user intent so the workflow still feels immediate

- Measured outcome:
  - `clienti` route chunk dropped from about `44.0 KB parsed / 13.1 KB gzip` to about `37.0 KB parsed / 11.7 KB gzip`
  - estimated improvement for this second pass: about `7.0 KB parsed` and `1.4 KB gzip`
  - total improvement versus the original pre-optimization route is now about `14.2 KB parsed` and `2.2 KB gzip`
  - newly deferred workflow chunks now map roughly to:
    - `ClientImportPreviewPanel.tsx`: `3.5 KB parsed / 1.3 KB gzip`
    - `ClientImportHelpDialog.tsx`: `3.9 KB parsed / 1.4 KB gzip`
    - `ClientImportResultDialog.tsx`: `2.6 KB parsed / 1.0 KB gzip`

- Important tradeoff:
  - import-related workflow UI now pays a small async load cost only when the user actually starts the import flow
  - import logic and semantics were preserved; only the rendering surface was deferred

## Heaviest Client Chunks

### High Severity

- `static/chunks/1710-31ae5454b2e2e23e.js`
  - Size: 429.4 KB parsed, 134.5 KB gzip
  - Scope: shared `main-app` client chunk
  - Main contributors:
    - `next/dist`: 263.3 KB parsed
    - `@sentry`: 146.6 KB parsed
    - `@sentry-internal/browser-utils`: 15.7 KB parsed
  - Assessment: globally shared and paid by most app routes; this is the single most important mobile load concern

- `static/chunks/main-1ae5984c2f4c79c1.js`
  - Size: 134.6 KB parsed, 39.8 KB gzip
  - Scope: shared `main` chunk
  - Main contributors:
    - `node_modules`: 131.9 KB parsed
    - local `src` bootstrap code: 1.4 KB parsed
  - Assessment: much improved after removing the static Sentry import from `instrumentation-client.ts`; this is no longer one of the worst startup offenders

- `static/chunks/1266-551f88780f9f1d57.js`
  - Size: 199.5 KB parsed, 53.0 KB gzip
  - Scope: initial on `app/layout` plus 28 entrypoints including most protected pages
  - Main contributors:
    - `@supabase/ssr/dist/module`: 173.2 KB parsed
    - `next/dist/compiled/buffer`: 22.0 KB parsed
  - Assessment: broad shared auth/session cost; likely justified by current Supabase browser/SSR pattern, but still a major first-load tax

- `static/chunks/4953.ec97afff34971906.js`
  - Size: 190.7 KB parsed, 62.6 KB gzip
  - Scope: async Sentry support chunk
  - Main contributor:
    - `@sentry`: 184.0 KB parsed
  - Assessment: still significant, but no longer paid directly through the old `main` bootstrap path

- `static/chunks/6229.9b097daa7179fe81.js`
  - Size: 338.5 KB parsed, 112.3 KB gzip
  - Scope: async Sentry chunk triggered by dynamic client monitoring paths
  - Main contributors:
    - `@sentry`: 324.7 KB parsed
    - `@sentry-internal/browser-utils`: 12.8 KB parsed
  - Assessment: still large, but shifted off the critical shared startup bundle; this is an acceptable trade for preserving monitoring while reducing first-load pressure

### Medium Severity

- `static/chunks/52774a7f.b625e23cf7336b8c.js`
  - Size: 119.2 KB parsed, 37.7 KB gzip
  - Scope: async Replay chunk
  - Main contributor:
    - `@sentry-internal/replay/build/npm/esm`: 118.8 KB parsed
  - Assessment: no longer initial after the Sentry follow-up; this is a meaningful startup win while keeping Replay available by explicit opt-in

- `static/chunks/2170a4aa.3a7f1e7166977d67.js`
  - Size: 402.4 KB parsed, 136.3 KB gzip
  - Scope: async feature chunk, not initial
  - Main contributor:
    - `node_modules/xlsx`: 401.6 KB parsed
  - Assessment: correctly split away from initial load, but still expensive when the clients import/export flow is opened on mobile

- `static/chunks/6227-07167bdbf2844153.js`
  - Size: 141.6 KB parsed, 40.1 KB gzip
  - Scope: shared across data-entry routes like `cheltuieli`, `activitati-agricole`, `comenzi`, `culegatori`, `investitii`, `recoltari/new`, `vanzari-butasi`, `parcele/[id]`, `clienti`
  - Main contributors:
    - `zod/v4`: 108.8 KB parsed
    - `react-hook-form`: 29.7 KB parsed
    - `@hookform/resolvers/zod`: 2.7 KB parsed
  - Assessment: expected for form-heavy screens, but noticeable because many protected CRUD routes share it

- `static/chunks/3418-e8887b0d6bd48e1b.js`
  - Size: 145.5 KB parsed, 40.0 KB gzip
  - Scope: currently initial only for `/` and `/admin/audit`
  - Main contributor:
    - `@radix-ui`: 143.8 KB parsed
  - Assessment: not a main dashboard/mobile authenticated issue, but notable for the public landing page and audit page

- `static/chunks/9859-8fd7483c28f1cdd6.js`
  - Size: 133.2 KB parsed, 44.5 KB gzip
  - Scope: currently initial only for `/`
  - Main contributors:
    - `framer-motion`: 69.0 KB parsed
    - `motion-dom`: 59.8 KB parsed
  - Assessment: isolated to landing; not part of the protected app core path

## Route-Local Findings

### `dashboard`

- Route chunk: `static/chunks/app/(dashboard)/dashboard/page-b5708db07a278064.js`
- Size: 41.8 KB parsed, 11.6 KB gzip
- Main local contributors:
  - `src/app/(dashboard)/dashboard/page.tsx`: 27.8 KB parsed
  - `src/lib/supabase/queries/cheltuieli.ts`: 4.0 KB parsed
  - `src/lib/supabase/queries/activitati-agricole.ts`: 2.7 KB parsed
- `src/lib/supabase/queries/solar-tracking.ts`: 2.1 KB parsed
- Assessment: the dashboard feels heavier than its own route chunk suggests because it inherits large shared bundles and still performs substantial runtime client fetching

### `dashboard` Follow-Up

- Latest measured route chunk: `static/chunks/app/(dashboard)/dashboard/page-7b477c8c857fc6e7.js`
- Size: about `43.6 KB parsed / 12.3 KB gzip`
- Latest main local contributor from analyzer:
  - `src/app/(dashboard)/dashboard/page.tsx`: about `29.2 KB parsed / 8.4 KB gzip`
- What changed in this pass:
  - removed the unused `clienti` query from the dashboard route
  - made the onboarding preference query conditional instead of always-on
  - reduced mount-time localStorage hydration churn
  - memoized major dashboard aggregations so UI-only dismiss state does not force full recomputation
- Assessment:
  - this pass improved runtime responsiveness more than bundle size
  - the dashboard route chunk remains moderate, which reinforces the earlier conclusion: the biggest dashboard cost is still shared bundle inheritance plus browser-side data assembly, not one oversized local chunk

### `vanzari-butasi`

- Route chunk: `static/chunks/app/(dashboard)/vanzari-butasi/page-86e78364a3ada3c5.js`
- Size: 45.3 KB parsed, 12.8 KB gzip
- Main local contributors:
  - `VanzariButasiPageClient.tsx`: 10.2 KB parsed
  - `VanzareButasiCard.tsx`: 8.2 KB parsed
  - `vanzari-butasi.ts` query module: 7.0 KB parsed
  - `clienti.ts` query module: 1.7 KB parsed
- Deferred follow-up chunks:
  - `AddVanzareButasiDialog.tsx`: 18.0 KB parsed
  - `EditVanzareButasiDialog.tsx`: 14.8 KB parsed
  - `ViewVanzareButasiDialog.tsx`: 10.0 KB parsed
- Assessment: no longer the heaviest authenticated route-local chunk; the initial experience is materially leaner and the deferred chunks align well with user intent

### `cheltuieli`

- Route chunk: `static/chunks/app/(dashboard)/cheltuieli/page-29e0ce430645b6a6.js`
- Size: 44.7 KB parsed, 13.6 KB gzip
- Main local contributors:
  - `CheltuialaPageClient.tsx`: 16.3 KB parsed
  - `cheltuieli.ts` query module: 4.1 KB parsed
  - `CheltuialaCard` and page-level app/ui chrome remain eager
- Deferred follow-up chunks:
  - `AddCheltuialaDialog.tsx`: 9.5 KB parsed
  - `EditCheltuialaDialog.tsx`: 8.1 KB parsed
  - `ViewCheltuialaDialog.tsx`: 5.2 KB parsed
  - `ConfirmDeleteDialog.tsx`: about 2.3 KB parsed
- Assessment: materially leaner on first paint; the remaining eager cost is mostly the page shell, cards, filters, and query layer that users need immediately

### `activitati-agricole`

- Route chunk: `static/chunks/app/(dashboard)/activitati-agricole/page-f3fc5bf1af8f493f.js`
- Size: 39.0 KB parsed, 11.8 KB gzip
- Main local contributors:
  - `page.tsx`: 13.8 KB parsed
  - `activitati-agricole.ts` query module: 2.8 KB parsed
  - `parcele.ts` query module: 2.5 KB parsed
  - summary cards, parcel status state, and expanded activity rows remain eager
- Deferred follow-up chunks:
  - `AddActivitateAgricolaDialog.tsx`: 12.6 KB parsed
  - `EditActivitateAgricolaDialog.tsx`: 11.7 KB parsed
  - `ConfirmDeleteDialog.tsx`: about 2.3 KB parsed
- Assessment: now clearly lighter at startup; what remains eager is the list and pause-status logic that define the page's first interaction

### `clienti`

- Route chunk: `static/chunks/app/(dashboard)/clienti/page-d393b2eb41da5939.js`
- Size: 37.0 KB parsed, 11.7 KB gzip
- Main local contributors:
  - `ClientPageClient.tsx`: 26.6 KB parsed
  - `ClientCard.tsx`: 4.9 KB parsed
  - the main route now mostly contains list UX, metrics derivation, search/filter state, and import parsing logic
- Additional async feature payload:
  - `xlsx`: 402.4 KB parsed, 136.3 KB gzip
- Deferred follow-up chunks:
  - `AddClientDialog.tsx`: 8.7 KB parsed
  - `EditClientDialog.tsx`: 7.4 KB parsed
  - `ClientDetailsDrawer.tsx`: 7.9 KB parsed
  - `ConfirmDeleteDialog.tsx`: about 2.3 KB parsed
  - `ClientImportPreviewPanel.tsx`: 3.5 KB parsed
  - `ClientImportHelpDialog.tsx`: 3.9 KB parsed
  - `ClientImportResultDialog.tsx`: 2.6 KB parsed
- Assessment: much healthier for beta. The route still carries import parsing and bulk-delete control logic, but the remaining eager cost now matches the first-view list experience much better

### `admin/analytics`

- Route chunk: `static/chunks/app/(dashboard)/admin/analytics/page-72bd38b69ccf544f.js`
- Size: 11.5 KB parsed, 3.5 KB gzip
- Main local contributors:
  - `KpiCard.tsx` and table UI
- Assessment: bundle size is not the main issue here; server-side data scanning remains the real performance risk

## Shared Vs Route-Local Summary

- Shared/global costs dominate first authenticated load more than any single dashboard page file
- Route-local costs are highest in:
  - `cheltuieli`
  - `activitati-agricole`
  - `clienti`
  - `vanzari-butasi` is now in the same range as the dashboard instead of being the top CRUD hotspot
- The dashboard's route chunk is only medium-sized; its responsiveness issues come from runtime data work plus the shared bootstrap bundle
- Landing-page-only motion and Radix payloads are meaningful, but they do not materially impact the protected dashboard mobile path

## Top 5 Heaviest Contributors

1. Next shared client/runtime internals in `static/chunks/76-*.js`
2. Sentry client stack spread across `main`, `main-app`, and replay chunks
3. Browser `@supabase/ssr` shared chunk used across most protected routes
4. `xlsx` async chunk used by clients import/export
5. Route-local `vanzari-butasi` dialogs/cards bundle
5. Route-local CRUD page clients, with `clienti` now improved enough that the next route-local attention can shift back toward broader shared costs

## Safest Next Optimizations

### Highest ROI

- Re-evaluate global Sentry client footprint
  - Best target: `instrumentation-client.ts` and `sentry.client.config.ts`
  - Why: Sentry and replay are the largest avoidable shared costs across authenticated routes
  - Caution: any change here affects observability and replay coverage

- Keep route-local feature weight deferable
  - Best target: only additional route-local passes where a page still keeps secondary workflow UI inline
  - Why: `vanzari-butasi`, `cheltuieli`, `activitati-agricole`, and now `clienti` all responded well to deferring non-first-view surfaces
  - Safe direction: keep applying lazy-load boundaries only to secondary actions, not to the first-view list and KPIs

- Preserve `xlsx` as async and isolate it further if needed
  - Best target: `src/app/(dashboard)/clienti/ClientPageClient.tsx`
  - Why: the chunk is already split, so the next safe win is preventing accidental early loading and keeping import/export actions fully user-triggered

### Medium ROI

- Audit whether the browser client truly needs `@supabase/ssr` on every authenticated screen
  - Why: it is a large shared dependency
  - Caution: this is architecture-sensitive and should not be changed casually because it impacts auth/session behavior

- Keep global client helpers lean in root layout/provider trees
  - Best target: `src/app/layout.tsx` and `src/app/providers.tsx`
  - Why: anything imported there tends to become shared bundle cost

## What Matters Most For Mobile

- The most important mobile reduction would come from trimming the shared authenticated bootstrap, not from shaving a few KB off the dashboard page file
- If only one area is optimized next, optimize Sentry client/replay loading strategy first
- If a second area is chosen, defer `vanzari-butasi` dialogs
- If a second area is chosen, focus on broader shared costs or the dashboard itself rather than doing another immediate `/clienti` pass
- If a third area is chosen, keep the clients import/export flow isolated from normal browsing so `xlsx` never loads unless explicitly needed

## Setup Retention

- The bundle analyzer setup remains in the repo
- Normal builds are unchanged
- Use:
  - PowerShell: `$env:ANALYZE='true'; npm run build`
  - Any shell with env support: `ANALYZE=true npm run build`
