# CODE_STRUCTURE

## Repository Map

The app uses `src/` as the real runtime root. Older docs may mention `/app`, `/components`, `/lib`, or `/api`; in practice these are mostly:

- `src/app`
- `src/components`
- `src/lib`
- `src/hooks`
- `src/types`
- `src/app/api`

## Top-Level Directories

### `src/app`

Next.js App Router routes, layouts, route groups, metadata, and API endpoints.

Important areas:

- `src/app/(auth)` public auth pages
- `src/app/magazin` public farmer storefront (`/magazin`, `/magazin/[tenantId]`) — catalog + coș local; loader `src/lib/shop/load-public-shop.ts`; **`/magazin/asociatie`** magazin multi-fermier „Gustă din Bucovina” (`load-association-catalog.ts`, `AssociationShopClient.tsx`, `AssociationLogo.tsx`, `AssociationHeroVisual.tsx`)
- `src/app/(dashboard)` protected app pages
- `src/app/(onboarding)` onboarding/demo entry
- `src/app/api` server routes
- `src/app/api/chat` AI chat API package split into `route.ts`, `chat-post-handler.ts`, `contract-helpers.ts`, `extractors.ts`, `signal-detectors.ts`, `conversation-memory.ts`, `date-helpers.ts`, `flow-detection.ts`, and `utils.ts`
- `src/app/api/shop/order` — public shop checkout (POST → `comenzi`, service role); notificare fermier opțională Resend în `src/lib/shop/notify-farmer-shop-order.ts` (vezi `AGENTS.md` / env)
- `src/app/api/association/producer-profile` — update profil public producător (admin/moderator asociație)
- `src/app/api/association/producer-photos` — upload/delete poze fermă pentru profilul public
- `src/app/api/association/settings` — salvează setările publice ale asociației în Storage JSON
- `src/app/auth/callback/route.ts` Supabase auth callback completion
- `src/app/layout.tsx` root layout, analytics, monitoring, toaster
- `src/app/providers.tsx` React Query and auth/add-action providers

### `src/components`

UI components grouped by module and shared app concerns.

Main categories:

- `src/components/app` app shell, headers, banners, feature gates, monitoring widgets
- `src/components/ui` reusable primitive UI components
- `src/components/layout` navigation shell components
- module folders like `parcele`, `recoltari`, `vanzari`, `comenzi`, `clienti`, `activitati-agricole`, `vanzari-butasi`
- `src/components/association/producatori/ProducerProfileEditor.tsx` dialog/sheet pentru profil public producător
- `src/components/association/settings/AssociationSettingsClient.tsx` ecran funcțional pentru branding/program magazin asociație
- `src/components/landing` marketing/landing page sections

### `src/lib`

Shared business logic and infrastructure.

Notable subfolders:

- `analytics` custom analytics event insertion
- `association` helpers pentru auth, queries, și setările publice ale hub-ului asociației
- `api` route security helpers
- `auth` tenant creation, redirects, superadmin checks
- `alerts` smart alert generation
- `calculations` profit calculations
- `config` beta config
- `demo` demo seed/reset/reload support
- `integrations` Google Contacts logic
- `monitoring` Sentry helpers
- `offline` IndexedDB queue and sync engine
- `onboarding` tenant routing helpers
- `parcele` parcel/crop metadata utilities
- `financial` shared OPEX/CAPEX categories and normalization helpers
- `subscription` plan logic
- `supabase` clients, admin client, business ID helper, query modules
- `tenant` tenant lookup helpers
- `ui` UI text/status helpers
- `utils` formatting and utility helpers

### `src/hooks`

Small client hooks for UI behavior, such as:

- body scroll lock
- demo banner visibility
- UI density

### `src/contexts`

App-specific React contexts.

Current notable context:

- `AddActionContext` for page-level add-action wiring

### `src/types`

Generated Supabase types and other runtime types.

Important file:

- `src/types/supabase.ts` generated database types and relationships

### `types`

Legacy or manual type definitions outside `src`.

Important note:

- `types/database.types.ts` appears to be a historical manual type file, not the main source of truth

### `supabase`

Database-specific assets.

Contains:

- `supabase/migrations` authoritative schema/history
- `supabase/snippets` ad hoc SQL snippets
- local Supabase metadata folders like `.branches` and `.temp`

### `tests` and `e2e`

Playwright test suites.

Coverage includes:

- multi-tenant security/RLS
- offline sync
- plan gating
- reports
- smoke/navigation

### `docs`

Repository documentation. This folder now includes persistent AI context files.

## Route Structure

### Public Pages

- `/`
- `/start`
- `/login`
- `/register`
- `/reset-password*`
- `/termeni`
- `/confidentialitate`

### Protected Dashboard Pages

- `/dashboard`
- `/parcele`
- `/parcele/[id]`
- `/recoltari`
- `/vanzari`
- `/vanzari-butasi`
- `/comenzi`
- `/clienti`
- `/culegatori`
- `/activitati-agricole`
- `/cheltuieli`
- `/investitii`
- `/stocuri`
- `/rapoarte`
- `/planuri`
- `/settings`
- `/admin/*` for superadmin-only screens (analytics dashboard: `src/lib/admin/analytics-dashboard-data.ts` + `src/components/admin/analytics/`)

### API Routes

All API routes live in `src/app/api`.

Main groups:

- `auth` beta guest and beta signup
- `demo` seed/reload/reset
- `farm` reset
- `gdpr` account/farm export-destructive flows
- `admin` tenant plan management
- `cron` admin metrics, demo cleanup, Google contacts sync
- `integrations/google` connect, callback, import

## Data Access Structure

Most domain CRUD is centralized under `src/lib/supabase/queries`.

Key query files:

- `parcele.ts`
- `culturi.ts`
- `recoltari.ts`
- `vanzari.ts`
- `comenzi.ts`
- `miscari-stoc.ts`
- `cheltuieli.ts`
- `activitati-agricole.ts`
- `clienti.ts`
- `culegatori.ts`
- `investitii.ts`
- `vanzari-butasi.ts`
- `solar-tracking.ts`
- `crops.ts`
- `crop-varieties.ts`

Implementation note:

- Agricultural activity options per terrain/unit type are centralized in `src/lib/activitati/activity-options.ts` (including `cultura_mare`-specific options).

## Infrastructure Files

- `src/proxy.ts` request guard and tenant header injector (Next.js 16: `export const config` in the same file; no separate `middleware.ts`)
- `src/lib/tenant/destructive-cleanup.ts` canonical tenant-scoped destructive delete order shared by reset/GDPR/demo cleanup flows
- `src/lib/offline/syncables.ts` local allowlist for tables that may use the generic idempotent sync RPC
- `src/lib/prefetch-idle.ts` constrained-network-aware idle prefetch helper used by mobile/dashboard navigation
- `src/lib/financial/categories.ts` centralized financial taxonomies and legacy-to-current normalization for cheltuieli/investiții/payment methods
- `next.config.js` PWA + Sentry config, plus conditional bundle analyzer support when `ANALYZE=true`
- `vercel.json` cron schedules
- `playwright.config.ts` E2E config
- `src/instrumentation.ts` + `src/instrumentation-client.ts` — singurele hook-uri Next pentru Sentry; `sentry.server.config.ts` / `sentry.edge.config.ts` la rădăcină; `src/lib/monitoring/sentry-runtime.ts` (release + rate-uri comune), `sentry-options.ts`, `sentry.ts`

## Structural Notes And Anomalies

- `src/app/(dashboard)/dashboard/page.tsx` is the active dashboard implementation.
- `src/lib/dashboard/engine.ts` is the Dashboard 2.0 logic layer (raw data model + parcel evaluator + rule builders for tasks/alerts/summary/weather window).
- The active dashboard UI is composed around `MeteoDashboardCard`, `TaskList`, `WelcomeCard`, and the widget exports from `src/components/dashboard/DashboardWidgets.tsx`, while gradually consuming engine outputs.
- `src/components/ui/MobileEntityCard.tsx` is the canonical shared mobile entity card used by module pages.
- `src/lib/supabase/queries/parcele.ts` has a schema-compat select fallback for linked environments missing newer dashboard relevance columns.
- Recoltare totals must use `getRecoltareTotalKg(...)` (`kg_cal1 + kg_cal2`) as the single runtime rule used by dashboard/KPI/reporting.
- AI chat keeps a strict contract split between `open_form` handoff and optional direct confirm-save paths; do not collapse these flows into one behavior.
- `src/app/(dashboard)/activitati-agricole/page.tsx` is intentionally a full client page instead of the usual split route/client pattern.
- `src/lib/s/upabase/queries` exists as an empty/stray path and looks accidental or legacy.
- Some historical docs in root are outdated relative to the current repository state.
