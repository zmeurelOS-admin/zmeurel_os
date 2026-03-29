# PERFORMANCE_AUDIT

## Scope

- Audit date: 2026-03-18
- Method: code inspection, `npm run build`, `ANALYZE=true npm run build`, analyzer output inspection, asset inspection, PWA config review
- No Lighthouse script is configured in the repo today, but bundle analysis is now available through `@next/bundle-analyzer`

## Overall Verdict

- Performance is acceptable for beta, but not yet comfortably scalable.
- The biggest risk is not a single oversized route file; it is the combination of a client-heavy dashboard, many browser-side Supabase fetches, and heavy shared client chunks.
- The dashboard should feel usable on modern phones and laptops, but weaker devices and slower networks will likely show delayed interactivity and noisier route transitions than ideal.

## What Was Measured

- App Router balance:
  - 31 non-API pages total
  - 10 pages declared directly as client pages
  - Key protected client pages include `/dashboard`, `/activitati-agricole`, `/recoltari/new`, `/settings`, `/planuri`
- Dashboard query fanout:
  - 7 core client queries: `recoltari`, `parcele`, `activitati`, `vanzari`, `cheltuieli`, `comenzi`, `clienti`
  - 2 deferred solar queries
  - 1 profile query
- Route chunk sizes from `.next/static/chunks/app` (raw, pre-compression):
  - `/dashboard`: about 41.3 KB
  - `/comenzi`: about 46.3 KB
  - `/rapoarte`: about 47.8 KB
  - `/activitati-agricole`: about 39.0 KB after lazy-loading secondary dialogs
  - `/clienti`: about 44.0 KB after lazy-loading dialogs and details drawer
  - `/vanzari-butasi`: about 45.3 KB after lazy-loading secondary dialogs
  - `/cheltuieli`: about 44.7 KB after lazy-loading secondary dialogs
- Shared chunks are materially larger than route chunks:
  - largest raw shared chunks are about 429.4 KB, 402.4 KB, and 389.2 KB

## Findings

### High

- The main dashboard is still the clearest production bottleneck.
  - `src/app/(dashboard)/dashboard/page.tsx` is a direct client page, around 1400 lines, and assembles most of its state in the browser.
  - It performs 10 client queries in one screen and then runs substantial filtering, grouping, alert derivation, KPI shaping, and UI branching in render-time React work.
  - Even after recent tuning, this is likely the main source of slower hydration and reduced responsiveness on weaker mobile devices.

- Shared client bundle weight is the larger concern than individual route chunks.
  - Route chunks themselves are moderate, but several shared chunks are very large in raw build output.
  - Without a bundle analyzer we cannot attribute them perfectly, but the likely contributors are the client-heavy dashboard shell, Supabase client usage across many pages, shared UI/instrumentation code, and feature-rich dashboard modules.

### Medium

- Dashboard route warming was doing extra work on the critical path.
  - Before this audit, `/dashboard` and the mobile bottom tab bar both prefetched primary routes immediately on mount.
  - That competed with dashboard data fetching and duplicated work on mobile.
  - This audit changed low-priority prefetch to an idle, deduplicated, constrained-network-aware helper.

- Admin analytics is still a server-side performance hotspot.
  - `src/components/admin/AnalyticsDashboard.tsx` no longer refreshes metrics during render, which is good.
  - It still reads 30 days of raw `analytics_events` and performs grouping/aggregation in component code.
  - That is acceptable for beta, but it will age poorly as event volume grows.

- The app remains structurally client-heavy.
  - Many protected pages still rely on page-client patterns and browser Supabase fetching.
  - Loading states are present, which helps perceived performance, but actual network and hydration work still happens mostly in the client.

- PWA behavior is safe but not especially aggressive for authenticated speed.
  - Public marketing/auth navigations use `NetworkFirst`.
  - `/api/*` and authenticated navigations use `NetworkOnly`.
  - This avoids stale authenticated HTML, but it also means offline or poor-network behavior for dashboard routes depends more on cached JS and client state than on cached route shells.

### Low

- Landing assets are reasonable but not tiny.
  - The largest landing screenshots are roughly 190-293 KB.
  - `next/image` is used on the landing page and shared nav/icon surfaces, which is the right direction.
  - This is not the main problem, but the hero screenshot still matters for public-page LCP.

- Some larger libraries are kept off the main dashboard path, which is positive.
  - `xlsx` is dynamically imported in the clients module instead of being part of the dashboard critical path.
  - `framer-motion` appears limited to landing components.
  - No active runtime use of `driver.js` or `@tanstack/react-table` was found in the inspected hot paths.

## Dashboard-Specific Notes

### Positive

- Core queries already use `staleTime`, `placeholderData`, and `refetchOnWindowFocus: false`.
- Solar fanout is deferred until core queries settle.
- Loading skeletons exist for the dashboard route.

### Remaining bottlenecks

- The dashboard still performs many client queries in parallel.
- It still re-derives many filtered arrays and summary values in the component.
- Local UI-only state changes can trigger recomputation of large derived sections because much of the page is computed in one component.
- The page eagerly imports many UI modules and dashboard presentation components in one client bundle.

## Bundle And Dependency Notes

- There is no repository-configured bundle analyzer today.
- Bundle analysis is now configured and should be used for follow-up route work.
- The analyzer confirms shared JS is the main problem, not only route-level page files.
- `xlsx` is correctly lazy-loaded per user action in the clients module.
- `framer-motion` is limited to public landing UI and should not affect the authenticated dashboard path.
- Sentry warnings during build are operationally useful but indicate some instrumentation cleanup remains.

## PWA And Mobile Notes

- `next-pwa` is configured conservatively:
  - `/_next/static/*`: `StaleWhileRevalidate`
  - `/_next/image`: `CacheFirst`
  - public static images: `CacheFirst`
  - `/api/*`: `NetworkOnly`
  - authenticated navigations: `NetworkOnly`
- This is a safe configuration for auth-sensitive routes.
- Mobile risk is less about service-worker overhead and more about client JS, multiple parallel fetches, and eager route warming.
- The fixed bottom bar is convenient, but its client runtime sits on every protected mobile page, so any extra work there is amplified.

## Safest Improvement Applied In This Audit

- Added idle, deduplicated route prefetching with network-awareness.
- Changed files:
  - `src/lib/prefetch-idle.ts`
  - `src/app/(dashboard)/dashboard/page.tsx`
  - `src/components/app/BottomTabBar.tsx`
- Behavior:
  - keeps route prefetch as a UX enhancement
  - skips low-priority prefetch on constrained networks (`saveData`, `2g`, `slow-2g`)
  - avoids duplicate mount-time prefetches between dashboard and bottom navigation

- Reduced `Vânzări Butași` route-local startup cost with lazy-loaded secondary surfaces.
- Changed files:
  - `src/app/(dashboard)/vanzari-butasi/VanzariButasiPageClient.tsx`
- Behavior:
  - keeps the initial orders list, KPIs, filters, and cards eager
  - defers add/edit/view/delete dialogs until first user intent
  - reduced the route chunk from about `96.2 KB parsed / 22.3 KB gzip` to about `45.3 KB parsed / 12.8 KB gzip`
  - shifts form-heavy dialog work off the first render path while preserving existing data flow and validation behavior

- Reduced route-local startup cost on the other CRUD-heavy pages using the same pattern.
- Changed files:
  - `src/app/(dashboard)/cheltuieli/CheltuialaPageClient.tsx`
  - `src/app/(dashboard)/activitati-agricole/page.tsx`
  - `src/app/(dashboard)/clienti/ClientPageClient.tsx`
- Behavior:
  - keeps list views, KPIs, search, and core filters eager
  - defers add/edit/view/delete surfaces and the clients details drawer until first user intent
  - route chunk improvements measured via analyzer:
    - `/cheltuieli`: about `59.0 KB parsed / 16.2 KB gzip` to `44.7 KB parsed / 13.6 KB gzip`
    - `/activitati-agricole`: about `53.8 KB parsed / 14.6 KB gzip` to `39.0 KB parsed / 11.8 KB gzip`
    - `/clienti`: about `51.2 KB parsed / 13.9 KB gzip` to `44.0 KB parsed / 13.1 KB gzip`
  - keeps business behavior unchanged while improving first-view responsiveness on mobile

- Reduced `/clienti` route-local startup cost again with a second focused pass on import workflow UI.
- Changed files:
  - `src/app/(dashboard)/clienti/ClientPageClient.tsx`
  - `src/components/clienti/ClientImportPreviewPanel.tsx`
  - `src/components/clienti/ClientImportHelpDialog.tsx`
  - `src/components/clienti/ClientImportResultDialog.tsx`
  - `src/components/clienti/import-types.ts`
- Behavior:
  - keeps the first-view list, KPIs, search, filters, and tuned CRUD actions eager
  - defers import preview/help/result surfaces until the user actually enters the import workflow
  - route chunk improvement measured via analyzer:
    - `/clienti`: about `44.0 KB parsed / 13.1 KB gzip` to `37.0 KB parsed / 11.7 KB gzip`
  - total improvement versus the original `/clienti` baseline is now about `51.2 KB parsed / 13.9 KB gzip` to `37.0 KB parsed / 11.7 KB gzip`

- Tuned the main dashboard for lower query fanout and lower client recomputation cost without changing its architecture.
- Changed files:
  - `src/app/(dashboard)/dashboard/page.tsx`
- Behavior:
  - removed one unnecessary initial dashboard query by dropping the unused `clienti` fetch from the dashboard route
  - made the `hide_onboarding` profile fetch conditional, so it only runs when the farm is still empty and the welcome card can actually be shown
  - initialized dismiss-state localStorage from lazy state instead of effect-only hydration, removing extra mount-time re-renders
  - grouped harvest, order, solar, and finance aggregations behind `useMemo`, so local dismiss interactions no longer recompute the full dashboard math on every click
  - analyzer/build inspection shows the route-local dashboard chunk stayed roughly flat at about `43.6 KB parsed / 12.3 KB gzip`; the gain from this pass is mainly runtime responsiveness and one less network request, not a large chunk-size drop

## Recommended Next Steps

### Priority 1

- Break the dashboard into server-assisted or deferred data sections instead of one large client aggregation surface.

### Priority 2

- Use the existing bundle analyzer on each performance pass so large shared chunks and route-local changes are measured instead of inferred.

### Priority 3

- Move admin analytics from raw 30-day event scans toward pre-aggregated SQL or scheduled rollups.

### Priority 4

- Audit the heaviest protected pages after dashboard:
  - `/cheltuieli` and `/activitati-agricole` improved materially after lazy-loading dialogs
  - `/vanzari-butasi` already improved materially after the same treatment
  - `/clienti` now has a healthier route-local profile after moving import workflow UI out of the initial chunk
  - the next optimization priority should shift back to dashboard responsiveness and shared bundle cost

### Priority 5

- Consider memoizing or segmenting the largest dashboard-derived calculations behind smaller components or deferred boundaries, but only after measuring with analyzer/profiling.

## Validation

- `npm run build`: passed
- `npm run typecheck`: passed
- `ANALYZE=true npm run build`: passed
- No Lighthouse script is currently available in the repository

## Beta Readiness

- Acceptable for beta: yes
- Ready for scale without further performance work: no
- Biggest remaining risks:
  - client-heavy dashboard hydration and responsiveness
  - large shared client chunks
  - server-side admin analytics aggregation cost
