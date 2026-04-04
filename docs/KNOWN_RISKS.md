# KNOWN_RISKS

## Highest-Risk Areas

### Authentication And Tenant Resolution

- `src/proxy.ts` is critical to request gating and header injection.
- `src/app/auth/callback/route.ts` contains complex auth completion and tenant-repair logic.
- Breaking either file can strand users in partial auth states or without tenant access.

### Tenant Isolation And RLS

- The entire app assumes strict tenant isolation.
- `profiles.tenant_id` is the backbone of tenant resolution.
- Query helpers and RLS policies are both part of the safety model.
- Never weaken filters or privileged fallbacks without auditing cross-tenant impact.
- `tenants` now has an association-staff update path restricted to public-profile fields only; changes to `association_staff_update_tenant_profile` or `enforce_tenants_assoc_admin_updates()` can accidentally reopen cross-tenant or over-broad writes.

### Service-Role Usage

- `src/lib/supabase/admin.ts` bypasses RLS.
- It is used by demo flows, cron jobs, GDPR/account deletion, and admin operations.
- Any expansion of service-role usage increases blast radius.
- Association settings persistence now uses service-role Storage access for `association-config/settings.json`; avoid moving that flow client-side without recreating explicit storage policies.

### Database Schema Drift

- Many modules contain compatibility fallbacks for missing columns, schema cache mismatches, or older RPC signatures.
- This is helpful operationally but means the codebase tolerates multiple schema states.
- Refactors that remove fallbacks can break production or partially migrated environments.
- Cheltuieli now also tolerates linked environments where `metoda_plata` is not migrated yet, so temporary client-side 400/column-missing fallbacks are still possible until linked schema catch-up is complete.
- Public producer profiles depend on `tenants.descriere_publica`, `specialitate`, `localitate`, and `poze_ferma`; if linked environments miss these columns or the new Storage bucket, admin editing and public profile rendering degrade.

### Stock-Affecting RPCs

- Harvests, sales, and orders rely on RPC-backed atomic behavior.
- Risk areas:
  - `create_recoltare_with_stock`
  - `update_recoltare_with_stock`
  - `delete_recoltare_with_stock`
  - `create_vanzare_with_stock`
  - `update_vanzare_with_stock`
  - `delete_vanzare_with_stock`
  - `deliver_order_atomic`
  - `delete_comanda_atomic`
  - `reopen_comanda_atomic`
- Changing client logic around these flows can cause stock inconsistencies.
- The automated stock audit in `Rapoarte` is advisory and depends on the integrity of both:
  - domain tables (`recoltari`, `vanzari`)
  - ledger data (`miscari_stoc`)
- If a migration gap or RPC regression breaks stock synchronization, the audit will surface discrepancies but is not itself the source of truth.
- The audit now marks degraded mode when `miscari_stoc` is missing/unavailable, but operators still need manual reconciliation because degraded output is intentionally non-blocking.
- Multi-granular stock reporting is intentionally conservative: variety and location detail are shown only when the underlying source rows support them explicitly.
- `vanzari` do not currently provide a trustworthy explicit variety dimension, so any future reporting changes must not backfill or proportionally infer sales by variety unless that becomes an approved domain rule first.

### Offline Sync And Idempotency

- IndexedDB queue state, retry behavior, and conflict handling are critical for offline support.
- The project depends on `client_sync_id` semantics and `upsert_with_idempotency`.
- Incorrect changes can create duplicates or false conflict states.

### Business ID RPC Drift

- Several modules still depend on the `generate_business_id` RPC for human-readable business IDs.
- The repaired local migration marks that function `volatile`, but linked environments may still serve a stale definition and repeat values like `CH202` or `CUL202`.
- Client helpers now detect repeated RPC values and fall back safely, but the long-term fix still depends on applying the repaired migration chain remotely.

### Demo Tenant Logic

- Demo users/tenants are real auth and data records, not mock-only client state.
- Reset/reload/cleanup flows delete real database rows.
- Markers like `data_origin` and `demo_seed_id` are safety-critical.

### Destructive GDPR/Reset Endpoints

- `api/farm/reset`
- `api/gdpr/account`
- `api/gdpr/farm`
- `api/demo/reset`
- `api/demo/reload`

These routes can delete significant amounts of data and use privileged access. They require careful review when touched.

### Destructive Flow Parity Drift

- Newer tenant-scoped tables are not covered consistently across all destructive flows.
- `src/app/api/farm/reset/route.ts` includes `culturi`, `culture_stage_logs`, and `solar_climate_logs`.
- `src/app/api/gdpr/farm/route.ts` and `src/app/api/cron/demo-tenant-cleanup/route.ts` currently do not.
- This creates data-retention, demo-cleanup, and GDPR-completeness risk when the schema evolves.
- The delete surface is now centralized in code and also includes tenant-scoped catalog/customization tables, but any new tenant table must still be added there deliberately.

### RPC Trust Boundary

- Several critical writes depend on SQL/RPC validation rather than fully self-contained TypeScript safety.
- Special attention is required for:
  - `upsert_with_idempotency`
  - stock-affecting RPCs that receive tenant-aware parameters
  - any function that accepts a client-provided target table or tenant ID
- The client layer should be treated as advisory only; SQL must enforce ownership and allowed targets.
- The client now keeps a local sync-table allowlist and ignores client-supplied tenant IDs in several write helpers, but the SQL contract is still the final source of truth.

## Security-Sensitive Details

### Same-Origin Mutation Checks

- Mutation routes commonly use `validateSameOriginMutation(...)`.
- Removing or bypassing that helper increases CSRF-like risk.

### Protected Accounts

- Some destructive flows protect a specific superadmin email from deletion.
- This is a business/security safeguard and should not be removed casually.

### Google Contacts Integration

- Integration routes are currently disabled with HTTP 410, but library code still exists.
- Refresh tokens are stored and there is an explicit TODO to encrypt them at rest.
- This is a notable security and compliance risk if the feature is re-enabled.

## Operational And Product Risks

### Beta Mode Overrides

- `BETA_MODE = true` and effective plan is forced to enterprise.
- This means plan-gating code exists but current runtime behavior may differ from tests or future production intent.

### Legacy And Parallel Code Paths

- `src/app/(dashboard)/activitati-agricole/page.tsx` differs from the common page/page-client split.
- `src/app/(dashboard)/activitati-agricole/ActivitatiAgricolePageClient.tsx` still exists as marked dead code and can confuse future changes if reused accidentally.
- `types/database.types.ts` is legacy while `src/types/supabase.ts` is the active generated type source.
- `src/lib/s/upabase/queries` looks like a stray/empty directory.

These are not immediate bugs, but they raise maintenance risk and can confuse future changes.

### Parcel Type Drift

- Parcel/unit type handling now includes `cultura_mare` in addition to `camp`, `solar`, and `livada`.
- Any future UI/type switch that assumes only the old three values can silently mislabel data or show wrong activity options.

### Test Drift Risk

- Playwright tests still reference plan values like `basic`, while runtime plan normalization now prefers `freemium` and beta forces enterprise behavior.
- This suggests potential test/product drift that should be checked before relying on plan-gating behavior.

### Analytics Non-Blocking Behavior

- Analytics is intentionally fire-and-forget.
- This is good for UX, but it also means failures are intentionally swallowed and easy to miss.

### Analytics Taxonomy Drift

- Product analytics currently mixes two helpers and several naming styles:
  - legacy action names such as `vanzare_add`
  - generic lifecycle names such as `create_success`
  - bespoke names such as `butasi_order_created`
- This makes cross-module reporting less clean and increases the chance of future drift if new events are added ad hoc.
- A standardized `trackEvent(...)` naming convention is now in place for new work, but historical legacy events and a few `track(...)` paths still exist and must be treated as compatibility data during reporting.

### Analytics Typing Drift

- `analytics_events` is now included in `src/types/supabase.ts`, and the main analytics reads/writes have been moved off broad `as any` casts.
- There is still schema parity drift between the linked Supabase project and newer local analytics migrations: the linked schema exposes the stable subset around `event_data` / `page_url`, while local migrations also describe `metadata` / `event_type`.
- Analytics runtime code now targets the shared subset on purpose, with compatibility isolated in `src/lib/analytics/schema.ts` instead of patching generated types.
- This is acceptable for beta, but future analytics changes should verify whether the remote migration chain has been repaired before assuming the richer analytics column set is live everywhere.

### Migration Chain Drift

- The local migration chain was repaired so pending migrations no longer contain invalid filenames or duplicate pending versions.
- `20260316b_culturi_suprafata_trigger.sql` was replaced by a valid sortable migration filename, and the previously blocking bundled RPC migrations were split into smaller units.
- `2026031304_cleanup_orphan_demo_tenants.sql` also needed a chain-position fix: at that point `public.tenants` still exposes `owner_user_id`, so using `t.user_id` was a later-schema assumption and broke linked execution.
- `2026031803_reopen_comanda_atomic_tenant_hardening.sql` also needed a linked-runner fix: the extra `notify pgrst, 'reload schema';` after the function definition created a multiple-command migration shape that the remote executor rejected.
- The linked Supabase project is still behind those repaired local migrations after `202603122350`.
- The remaining blocker from this workspace is now external/operational: `supabase db push --linked --dry-run` fails with `password authentication failed for user "cli_login_postgres"`, so linked catch-up still needs a valid DB password / refreshed link session before push can complete.
- One historical short version `20260313` still exists in remote history and local history for an already-applied migration; this is acceptable for beta, but the chain should avoid reintroducing that pattern.

### Admin Analytics Performance

- `src/components/admin/AnalyticsDashboard.tsx` refreshes daily metrics during render and reads broad 7-day/30-day analytics datasets with service-role access.
- This is safe from a privilege perspective because it is server-side, but it is a clear performance hotspot as event volume grows.
- The render-time refresh issue has been removed, but raw 30-day event scans and in-component aggregation remain the main admin analytics scale risk.
- `tenant_metrics_daily` helps with coarse daily snapshots only; module usage, funnels, and failed-action reporting still depend on request-time scans over raw `analytics_events`.

### Client-Heavy Dashboard

- The main dashboard route is a large client component with many parallel Supabase reads and heavy derived aggregation.
- This increases hydration cost and shifts performance pressure to the browser.
- Route warming is now deferred to idle time and skips constrained networks, but the dashboard remains the main user-facing performance hotspot.
- Dashboard and Parcele both depend on `getParcele()`; when linked environments lag parcel schema columns (`rol`, `apare_in_dashboard`, `contribuie_la_productie`, `status_operational`), both screens can fail together without compatibility handling.
- `src/lib/supabase/queries/parcele.ts` now includes a legacy-select fallback with safe defaults for these fields to reduce linked-schema outage risk.

### Shared Client Bundle Weight

- Real bundle analysis shows that the largest mobile-critical costs are mostly shared, not route-local.
- The heaviest global client contributors are the Next runtime, Sentry client instrumentation/replay, and the browser `@supabase/ssr` client wrapper.
- This means even relatively small route chunks can still feel heavy on first load because they inherit large shared bundles.
- `xlsx` is correctly split into its own async chunk, but it remains a very large feature payload on the clients import/export path.
- A follow-up Sentry optimization reduced the critical `main` chunk substantially by removing static client bootstrap imports from `instrumentation-client.ts`, and Replay is now opt-in plus async.
- Remaining Sentry cost is still meaningful in shared `main-app` chunks because core browser error monitoring stays enabled globally.

### Historical Documentation Drift

- Root documentation such as `README.md` reflects an older project snapshot.
- Future work should trust current code and migrations over older prose.

## What To Double-Check Before Major Changes

- auth + callback flow
- tenant lookup helpers
- RLS assumptions
- service-role access paths
- stock-affecting RPC contracts
- migration history for touched tables
- demo lifecycle logic
- offline queue semantics
- analytics writes and admin metrics jobs

## Maintenance Rule

When architecture, domain logic, or repository structure changes, update this file incrementally so future agents inherit the latest known risk map.
