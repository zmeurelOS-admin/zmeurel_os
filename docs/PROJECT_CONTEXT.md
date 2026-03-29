# PROJECT_CONTEXT

## What The Application Does

Zmeurel is an agricultural operations platform focused on Romanian farms. It supports both classic berry-farm workflows and greenhouse/solar workflows. The app helps a farm owner track operational work, production, stock, orders, sales, clients, workers, expenses, and compliance-sensitive account actions.

The product also includes:

- beta signup and guest demo onboarding
- tenant-scoped demo datasets
- admin analytics and plan management
- offline-first mutation support
- PWA behavior
- GDPR-style export and deletion flows

## Main User Flows

### 1. Authentication And Tenant Entry

- Public entry is `/` and `/start`.
- Users can log in with email/password or Google.
- Beta signup can create a user and tenant immediately.
- Guest demo signup creates a temporary demo tenant and signs the user in.
- `src/proxy.ts` guards protected routes and redirects users without a tenant to onboarding.
- `src/app/auth/callback/route.ts` completes Supabase auth flows and repairs missing tenant assignments when needed.

### 2. Dashboard

- Authenticated users land in the dashboard area.
- Dashboard aggregates data from parcels, harvests, sales, expenses, orders, activities, clients, and solar telemetry.
- It surfaces operational alerts, delivery load, production metrics, finance summaries, and onboarding guidance.

### 3. Parcel And Crop Management

- Parcels are the core location/unit entity.
- A parcel can be `camp`, `solar`, `livada`, or `cultura_mare`.
- Solar units can contain multiple `culturi` rows and extra climate/stage tracking.
- Parcel notes can embed hidden structured metadata for solar crop rows and harvest crop selection.

### 4. Harvest, Stock, And Labor Flow

- Harvests (`recoltari`) are recorded per parcel and picker.
- Harvest writes go through stock-safe RPC functions.
- Labor expense sync can automatically aggregate harvest labor into `cheltuieli_diverse`.
- Deleting or editing harvests can affect stock and downstream labor calculations.

### 5. Orders, Sales, And Seedling Sales

- `comenzi` represent client delivery orders.
- Delivering an order can atomically create a linked sale and deduct stock.
- `vanzari` represent sales, also backed by stock-safe RPCs.
- `vanzari_butasi` is a separate workflow for seedling orders with line items.

### 6. Operational Modules

- agricultural activities and treatment pause logic
- expenses (OPEX) and investments (CAPEX)
- clients and pickers
- stock visibility by location/quality/storage
- reports, export flows, and an automated stock audit with anomaly/recommendation output
- multi-granular stock reporting that degrades gracefully between product, variety, and location detail based on the real source data available
- settings, farm management, demo controls, and GDPR actions

## High-Level Architecture

- Route layer: `src/app`
- Client UI modules: `src/components`
- Shared logic and data access: `src/lib`
- Context and app-wide providers: `src/app/providers.tsx`, `src/contexts`
- Database schema and migrations: `supabase/migrations`

The app is primarily a client-driven dashboard over Supabase, but critical write paths and privileged operations are enforced server-side using:

- Next.js API routes
- Supabase RPC functions
- service-role admin clients
- RLS and tenant-aware queries

Notable API packaging detail:

- `src/app/api/chat/*` is an intentionally split AI chat package: `chat-post-handler.ts` orchestrates, while extraction, signal detection, conversation memory, date helpers, flow detection, and shared parsing utilities live in adjacent focused modules.

## Database Usage

Supabase is used for:

- authentication
- tenant ownership and profiles
- operational business data
- analytics events
- admin metrics
- demo seed/reset flows
- stock and fulfillment RPCs

Common table groups:

- identity and tenancy: `profiles`, `tenants`
- farm operations: `parcele`, `culturi`, `activitati_agricole`, `recoltari`, `culegatori`
- commercial: `clienti`, `comenzi`, `vanzari`, `vanzari_butasi`, `vanzari_butasi_items`
- finance/inventory: `cheltuieli_diverse`, `investitii`, `miscari_stoc`
- solar-specific: `solar_climate_logs`, `culture_stage_logs`, `crops`, `crop_varieties`
- product telemetry/admin: `analytics_events`, `alert_dismissals`, `integrations_google_contacts`

## Security And Tenant Model

- The app is explicitly multi-tenant.
- Each business row belongs to a tenant.
- Tenant context is derived from `profiles.tenant_id`.
- Authenticated users should only see and mutate tenant-owned data.
- Superadmin access exists and is checked via `profiles.is_superadmin`.
- Same-origin checks protect mutation API routes.
- Service-role access is used for admin, cron, demo, and destructive maintenance flows.

## Important Cross-Cutting Behaviors

### Backward-Compatible Schema Handling

Some query modules include compatibility fallbacks for environments missing recent migrations, especially around:

- sync/idempotency columns
- schema cache mismatches
- older sales/order schemas

### Offline-First Behavior

- IndexedDB stores a sync queue.
- Sync uses `upsert_with_idempotency`.
- Conflict and retry states are persisted locally.

### Beta Mode

- `BETA_MODE` is enabled.
- Effective plan is forced to enterprise in current config.
- Some administrative plan-management behavior is intentionally disabled during beta.

### Demo Mode

- Demo users and demo tenants are first-class flows.
- Demo data can be seeded, reloaded, deleted, and auto-cleaned by cron.
- Demo markers use `data_origin` and `demo_seed_id`.

## Core Domain Concepts

- tenant: isolated farm/business workspace
- profile: auth user profile linked to a tenant
- parcela: farm unit/location such as field, orchard, or solar
- cultura: crop within a solar or tracked crop context
- recoltare: harvest event
- activitate agricola: agricultural task or treatment
- culegator: worker/picker
- client: buyer/contact
- comanda: order to fulfill
- vanzare: completed sale
- miscari stoc: stock ledger movements
- cheltuiala: current operational cost (OPEX), using a simplified universal taxonomy and optional payment method
- investitie: longer-lived farm asset/development cost (CAPEX), using a simplified universal taxonomy

## Current Reality Notes

- Runtime code is richer than the historical README suggests.
- `src/app/(dashboard)/dashboard/page.tsx` is the real dashboard implementation.
- Some legacy or parallel code still exists and should be validated before cleanup.
