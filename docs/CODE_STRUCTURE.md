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
- `src/app/(dashboard)` protected app pages
- `src/app/(onboarding)` onboarding/demo entry
- `src/app/api` server routes
- `src/app/api/chat` AI chat API package split into `route.ts`, `chat-post-handler.ts`, `contract-helpers.ts`, `extractors.ts`, `signal-detectors.ts`, `conversation-memory.ts`, `date-helpers.ts`, `flow-detection.ts`, and `utils.ts`
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
- `src/components/landing` marketing/landing page sections

### `src/lib`

Shared business logic and infrastructure.

Notable subfolders:

- `analytics` custom analytics event insertion
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
- `/admin/*` for superadmin-only screens

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

- `src/proxy.ts` request guard and tenant header injector
- `src/lib/tenant/destructive-cleanup.ts` canonical tenant-scoped destructive delete order shared by reset/GDPR/demo cleanup flows
- `src/lib/offline/syncables.ts` local allowlist for tables that may use the generic idempotent sync RPC
- `src/lib/prefetch-idle.ts` constrained-network-aware idle prefetch helper used by mobile/dashboard navigation
- `src/lib/financial/categories.ts` centralized financial taxonomies and legacy-to-current normalization for cheltuieli/investiții/payment methods
- `next.config.js` PWA + Sentry config, plus conditional bundle analyzer support when `ANALYZE=true`
- `vercel.json` cron schedules
- `playwright.config.ts` E2E config
- `instrumentation.ts` and `instrumentation-client.ts` Sentry instrumentation

## Structural Notes And Anomalies

- `src/app/(dashboard)/dashboard/page.tsx` is the active dashboard implementation.
- `src/components/dashboard/DashboardHome.tsx` appears legacy/parallel and should be validated before reuse.
- `src/app/(dashboard)/activitati-agricole/page.tsx` is intentionally a full client page instead of the usual split route/client pattern.
- `src/lib/s/upabase/queries` exists as an empty/stray path and looks accidental or legacy.
- Some historical docs in root are outdated relative to the current repository state.
