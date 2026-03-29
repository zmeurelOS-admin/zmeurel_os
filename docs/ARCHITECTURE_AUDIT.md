# ARCHITECTURE_AUDIT

## Scope

- Audit date: 2026-03-18
- Reviewed using existing repository context plus targeted code inspection.
- Application code was not modified.

## Overall Evaluation

- Overall architecture is solid for a small-to-mid multi-tenant SaaS: Supabase Auth, tenant resolution through `profiles.tenant_id`, RLS-backed data access, and service-role usage mostly constrained to server routes, cron jobs, admin tools, demo lifecycle, and repair flows.
- The strongest part of the design is the auth-to-tenant pipeline: `src/proxy.ts`, `src/app/auth/callback/route.ts`, `src/lib/tenant/get-tenant.ts`, and `src/lib/auth/ensure-tenant.ts` form a coherent request-gating and tenant-repair model.
- The main architectural weakness is consistency, not raw capability: some modules apply explicit tenant filters while others rely only on RLS, destructive flows have drifted out of sync as new tenant tables were added, and analytics/performance patterns are more client-heavy than the App Router architecture would ideally encourage.

## Executive Risk Summary

- High: destructive-flow parity drift across tenant data deletion/reset paths.
- Medium: RPC trust boundaries depend heavily on SQL-side validation that is not fully obvious from TypeScript callers.
- Medium: inconsistent defense-in-depth for tenant filtering in client query helpers.
- Medium: admin analytics page does heavy service-role reads and metric refresh during render.
- Medium: dashboard and module pages are client-heavy and trigger many browser-side Supabase fetches.
- Low: analytics taxonomy is useful but inconsistent, which weakens reporting quality rather than security.

## 1. Multi-Tenant Safety Audit

### Safe patterns

- Server pages commonly resolve tenant ID first, then apply explicit `.eq('tenant_id', tenantId)` filters before reading business data.
- Examples include `clienti`, `stocuri`, `vanzari-butasi`, `recoltari`, `vanzari`, and `comenzi` flows.
- `src/proxy.ts` enforces authenticated access for protected routes and injects tenant/user headers for downstream layout context.
- Admin access is centrally guarded by `src/app/(dashboard)/admin/layout.tsx`.
- Service-role usage is kept in server-only files; no client component imports of `src/lib/supabase/admin.ts` were found.

### Suspicious or inconsistent patterns

- Some client-side query helpers do not add explicit tenant filters and rely entirely on RLS:
  - `src/lib/supabase/queries/activitati-agricole.ts`
  - `src/lib/supabase/queries/cheltuieli.ts`
  - `src/lib/supabase/queries/solar-tracking.ts`
- This is not automatically unsafe if RLS is correct, but it weakens defense-in-depth and makes accidental policy regressions more dangerous.

### Areas needing review

- Any future module that bypasses the shared tenant helper pattern should be treated as high-review.
- RLS policies for the tables above should be re-checked whenever schema changes land.

## 2. Supabase RLS And Auth Patterns

### Safe patterns

- `src/lib/supabase/admin.ts` uses `SUPABASE_SERVICE_ROLE_KEY` only in server-side contexts with `persistSession: false`.
- Auth callback flow sanitizes redirect targets using `safeNextPath(...)` and derives redirect base URL defensively.
- Mutation routes commonly use `validateSameOriginMutation(...)`, reducing CSRF-like exposure for cookie-authenticated requests.
- `ensureTenantForUser(...)` repairs partially provisioned users instead of leaving them in broken states.

### Review notes

- Admin pages are protected, but not every admin page repeats a local superadmin check; some rely on layout-only protection. This is acceptable, but less robust than full defense-in-depth.
- `src/components/admin/AnalyticsDashboard.tsx` uses the service-role client in a component file. It is safe because the component is server-rendered, but this is architecturally surprising and easy to misread during refactors.

## 3. RPC And Database Interaction Review

### Strong patterns

- Harvest, sales, and order-delivery flows correctly push stock-sensitive mutations into SQL RPCs rather than splitting them across multiple browser-side queries.
- `recoltari`, `vanzari`, and `comenzi` modules use RPC-backed atomic paths for create/update/delete or delivery/reopen/delete.
- This is the right architectural choice for stock consistency.

### Risks and review items

- `createVanzare(...)` accepts optional `tenant_id` input and forwards it to `create_vanzare_with_stock`.
- `insertMiscareStoc(...)` accepts optional `tenant_id` input before insert.
- `createRecoltare(...)` and several order RPC callers forward tenant-aware parameters to SQL.
- `SyncEngine` calls the generic RPC `upsert_with_idempotency` with a client-provided `table_name` and arbitrary payload.
- None of the above are confirmed vulnerabilities by themselves, but they create a strict requirement: SQL must re-check tenant ownership and allowlist valid target tables instead of trusting caller-supplied values.

### Transactional consistency observations

- Stock-affecting RPC design reduces race-condition risk compared with client-orchestrated writes.
- A residual risk remains where post-write side effects are non-atomic. Example: `recoltari` labor-expense sync runs after the main RPC, so the harvest may succeed while auto-generated labor expense sync fails. The code surfaces a warning, which is appropriate, but it still creates eventual-consistency behavior.

## 4. Offline Sync Architecture

### Positive findings

- IndexedDB queue tracks pending, syncing, failed, conflict, and synced states.
- The sync engine has retry/backoff, online detection, and conflict detection.
- Conflict and duplicate handling is intentionally tied to idempotency semantics rather than naive re-submit loops.

### Risks

- Queue safety depends heavily on server-side `upsert_with_idempotency` being strict about table allowlists and tenant ownership.
- Failed records are re-enqueued after network errors, which is fine, but idempotency correctness is critical because retries are expected behavior.
- Conflict resolution is mostly flag-based; there is no richer merge strategy visible in the client layer.

### Risk level

- Medium: architecture is reasonable, but correctness is delegated to SQL contracts that should be explicitly audited whenever offline scope expands.

## 5. Next.js App Router Architecture

### Current pattern

- The repository uses App Router, but many dashboard pages are client components and fetch directly from browser Supabase query helpers with React Query.
- `src/app/(dashboard)/dashboard/page.tsx` is a large client page that issues many parallel queries for parcels, harvests, sales, orders, activities, expenses, clients, and solar logs.

### Risks

- More browser-side hydration and JS work than necessary.
- More repeated tenant resolution and client-side Supabase round trips.
- Higher chance of inconsistent loading states across modules.
- More pressure on analytics and offline code because much of the app lifecycle happens in the client.

### Risk level

- Medium for performance and maintainability, low for security.

## 6. Analytics And Event Tracking

### Positive findings

- Analytics is intentionally non-blocking and failures are swallowed so UX is never blocked.
- Event data is tenant-scoped and user-scoped when context is available.
- Page views, create-form lifecycle events, sync outcomes, exports, and auth events are tracked.

### Consistency issues

- Tracking is split between two APIs:
  - `track(...)` for page views and legacy/simple events
  - `trackEvent(...)` for module/status-aware events
- Admin analytics already contains logic to reconcile both models, which is a smell: reporting is compensating for taxonomy drift.

### Missing/partial tracking observations

- Coverage is good for create flows and page views, but edit/delete/search patterns are not uniformly structured across modules.
- Some modules use `track`, some `trackEvent`, and some both for the same user action.

### Risk level

- Low for security, medium for analytics reliability and admin reporting clarity.

## 7. Security Surface Review

### Safe patterns

- `src/proxy.ts` preserves callback routes correctly and avoids clearing PKCE cookies during auth callback.
- `src/app/auth/callback/route.ts` uses safe redirect path validation and defensive error handling.
- Cron routes require `CRON_SECRET`.
- Same-origin validation is applied in exposed mutation routes.

### Areas needing review

- Cron routes compare secrets directly with `===`; acceptable for most internal cron usage, but if the threat model hardens, constant-time comparison would be safer.
- Demo/admin/GDPR routes have large blast radius by design because they use service-role access. Their safety depends on route guards, ownership checks, and full table coverage.

## 8. Code Quality And Architecture Consistency

### Findings

- `src/components/dashboard/DashboardHome.tsx` appears legacy and parallel to the real dashboard implementation.
- `src/app/(dashboard)/activitati-agricole/page.tsx` does not follow the same page/page-client split seen in many other modules.
- `types/database.types.ts` and `src/types/supabase.ts` suggest old/new type paths coexisting.
- `src/lib/s/upabase/queries` looks like a stray directory.
- Admin route protection is slightly inconsistent between layout-only guarding and page-level defense-in-depth.

### Risk level

- Low to medium: mostly maintenance drag and refactor confusion rather than immediate defects.

## 9. Performance Observations

### Higher-risk hotspots

- `src/components/admin/AnalyticsDashboard.tsx` calls `refresh_tenant_metrics_daily` during page render and then performs broad 7-day and 30-day reads from `analytics_events` with service-role access.
- The dashboard page performs many parallel browser-side fetches and then derives a large amount of client-only aggregation.
- Solar dashboard insights add more high-volume reads (`getSolarClimateLogsForUnitati`, `getCultureStageLogsForUnitati`) on top of the core module queries.

### Likely effects

- Slower admin analytics render time as event volume grows.
- Heavier client hydration and slower first-interaction time on the main dashboard.
- Greater variance between cold and warm navigations because so much state is assembled on the client.

## 10. Confirmed Findings

### High

- Destructive-flow parity drift:
  - `src/app/api/farm/reset/route.ts` deletes `culturi`, `culture_stage_logs`, and `solar_climate_logs`.
  - `src/app/api/gdpr/farm/route.ts` does not include those tables.
  - `src/app/api/cron/demo-tenant-cleanup/route.ts` also omits them.
  - Result: reset/delete/cleanup behavior is no longer consistent for newer tenant-scoped data. This is a real operational and GDPR-retention risk.

### Medium

- RLS-only query helpers reduce defense-in-depth in:
  - `src/lib/supabase/queries/activitati-agricole.ts`
  - `src/lib/supabase/queries/cheltuieli.ts`
  - `src/lib/supabase/queries/solar-tracking.ts`

- RPC trust boundary needs explicit SQL audit:
  - `src/lib/supabase/queries/vanzari.ts`
  - `src/lib/supabase/queries/recoltari.ts`
  - `src/lib/supabase/queries/comenzi.ts`
  - `src/lib/offline/syncEngine.ts`

- Admin analytics performs expensive render-time work with service-role reads:
  - `src/components/admin/AnalyticsDashboard.tsx`

- Main dashboard is client-heavy and query-dense:
  - `src/app/(dashboard)/dashboard/page.tsx`

### Low

- Analytics taxonomy drift between `track(...)` and `trackEvent(...)`.
- Slight inconsistency in admin defense-in-depth between layout-only and page-local checks.

## 11. Recommended Improvements

### Priority 1

- Make tenant-scoped destructive flows table-complete and keep them in lockstep:
  - `farm/reset`
  - `gdpr/farm`
  - demo reset/reload/cleanup
- Add a documented checklist so every new tenant table is reviewed against all destructive flows.

### Priority 2

- Audit SQL for:
  - `upsert_with_idempotency`
  - `create_vanzare_with_stock`
  - `update_vanzare_with_stock`
  - `create_recoltare_with_stock`
  - order atomic RPCs
- Ensure tenant IDs are derived or validated server-side and target tables are allowlisted.

### Priority 3

- Normalize client query helpers toward one standard:
  - explicit tenant filter where practical
  - RLS still required as the final safety net

### Priority 4

- Move admin analytics refresh and large aggregations to cron/materialized snapshots or SQL aggregation instead of render-time full scans.

### Priority 5

- Gradually migrate the heaviest dashboard paths toward server components or server-preloaded data where it improves first-load performance.

### Priority 6

- Consolidate analytics taxonomy so admin reports do not need to reconcile parallel event styles.

## Final Assessment

- Security posture: good, with medium-risk review items around privileged deletion coverage and SQL trust boundaries.
- Multi-tenant posture: generally strong, provided RLS remains correct and privileged flows stay synchronized with schema evolution.
- Performance posture: acceptable today, but the admin analytics page and client-heavy dashboard are the clearest scale risks.
- Maintainability posture: fair; the repo would benefit from reducing architectural drift and documenting destructive-flow invariants more explicitly.

## Mitigation Notes

- 2026-03-18 follow-up implementation centralized tenant destructive cleanup order in shared server code.
- 2026-03-18 regression follow-up expanded that shared delete order to cover tenant-scoped catalog/customization tables (`crops`, `crop_varieties`, `nomenclatoare`, `activitati_extra_season`) so farm-reset/GDPR wipes do not leave custom tenant data behind.
- 2026-03-18 follow-up implementation added a client-side allowlist for generic offline sync tables.
- 2026-03-18 follow-up implementation hardened SQL for `upsert_with_idempotency`, `delete_comanda_atomic`, and `reopen_comanda_atomic` so tenant validation does not rely on TypeScript callers alone.
- 2026-03-18 performance follow-up moved low-priority dashboard/mobile route prefetch onto an idle, deduplicated, constrained-network-aware helper to reduce first-load competition on weaker devices.
