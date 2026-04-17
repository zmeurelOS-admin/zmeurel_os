# AGENTS.md

## Project Overview

Zmeurel is a Romanian multi-tenant agricultural SaaS for farm operations management. The product covers berry farms and greenhouse/solar operations, with modules for parcels, crops, harvests, sales, seedling orders, clients, workers, expenses, investments, agricultural activities, stock, reports, settings, demo onboarding, and admin analytics.

Runtime app code lives under `src/`, especially `src/app` for routes and `src/lib` for data access and business logic. Supabase database migrations live under `supabase/migrations/`, and Supabase Edge Functions now live under `supabase/functions/`.

## Architecture Summary

- Frontend: Next.js 16 App Router with React 19 and TypeScript.
- UI: Tailwind CSS v4, shadcn/ui, Radix primitives, Lucide icons.
- Design System: Warm multi-layer shadows, press states, granular typography weights, generous spacing, limited glass usage.
- Data fetching: TanStack Query in client pages.
- Forms: React Hook Form + Zod.
- Backend/data: Supabase PostgreSQL + Auth + RLS.
- Monitoring: Sentry.
- Product analytics: Vercel Analytics/Speed Insights plus custom `analytics_events`.
- PWA/offline: `next-pwa`, IndexedDB sync queue, idempotent mutation flow.
- **Web Push (VAPID)**: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` (generate with `npx web-push generate-vapid-keys`; never commit secrets) + opțional `VAPID_SUBJECT` (`mailto:...`, fallback sigur dacă lipsește). Subscriptions in `push_subscriptions` (migrare `20260405006_push_subscriptions.sql`). Server: `src/lib/notifications/send-push.ts` (`web-push`, best-effort, sender în Next/Vercel, nu în Supabase Edge Functions). După build, `postbuild` rulează `scripts/append-push-sw-import.js` ca să adauge `importScripts('/push-handlers.js')` la `public/sw.js` generat de Workbox. Handler-e în `public/push-handlers.js`. API: `POST /api/push/subscribe`, `POST /api/push/unsubscribe`, `POST /api/push/test` (autentificat, intern, pentru verificare end-to-end). UI: `PushPermissionBanner`, `usePushSubscription`, setări la `/settings` → Notificări push. Salvarea subscription folosește doar coloanele de bază (`user_id`, `endpoint`, `keys_p256dh`, `keys_auth`) ca să rămână compatibilă și cu medii unde coloanele opționale nu sunt aliniate. Trimitere automată doar pentru tipuri cu `pushEnabled` în `src/lib/notifications/config.ts` (implicit doar `order_new`).

Core runtime pattern:

- `src/proxy.ts` acts as the request guard and injects user/tenant headers (Next.js 16: `proxy.ts` + static `export const config` in the same file; nu păstra `middleware.ts` duplicat).
- Browser hardening headers sunt centralizate în `next.config.js` prin `src/lib/security/http-headers.js` (CSP + security headers). Dacă adaugi integrări externe noi (script/img/connect), actualizează allowlist-ul CSP din helper.
- **Demo → creare fermă**: CTA „Creează-ți ferma” (`DemoBanner`, secțiunea Parolă din `/settings`) folosește `<form method="POST" action="/api/auth/leave-demo">` — `validateSameOriginMutation`, `createClient().auth.signOut()`, răspuns `303` la `/start` (fără `fetch` + `location.replace` în client).
- **Logout sesiune (server)**: `POST /api/auth/sign-out` — `validateSameOriginMutation`, `createClient().auth.signOut()`, `303`; implicit la `/`, opțional `?next=/path` (path relativ, ex. `?next=/login` după ștergere cont). UI: `LogoutButton`, `MoreMenuDrawer`, `MoreMenu` și ștergere cont în setări folosesc același POST (form + `prepareClientBeforeServerSignOut` pentru cache Supabase/React Query).
- **Step-up auth pentru acțiuni destructive**: `POST /api/auth/destructive-step-up` verifică parola curentă (same-origin + sesiune validă), apoi emite token scurt-lived, semnat și single-use (`x-zmeurel-step-up-token`). Tokenul este obligatoriu pentru rutele critice: `POST /api/farm/reset`, `DELETE /api/gdpr/farm`, `DELETE /api/gdpr/account`. Config server-only: `DESTRUCTIVE_ACTION_STEP_UP_SECRET`; protecții suplimentare pentru ștergere cont se configurează prin `ACCOUNT_DELETE_PROTECTED_USER_IDS` (UUID list).
- **Scripturi destructive (ops)**: utilitarele din `scripts/cleanup-demos.ts`, `scripts/cleanup-beta-accounts.ts`, `scripts/reset-test-users.ts` protejează conturile privilegiate prin `profiles.is_superadmin` + allowlist pe user IDs (`*_PROTECTED_USER_IDS`), fără email personal hardcodat.
- **Guard CI anti-hardcodare sensibilă**: `scripts/check-sensitive-hardcoding.mjs` rulează în `npm run check:critical` și blochează reintroducerea de emailuri personale hardcodate, comparații directe pe email pentru permisiuni, allowlist-uri inline fragile și secrete/tokenuri/API keys literale în fișierele noi/modificate.
- Guardul scanează doar fișiere text relevante schimbate când are diff Git disponibil (în CI prin `SENSITIVE_GUARD_BASE_SHA` / base ref), ca să evite blocarea repo-ului pe istoricul vechi; excluderile deliberate includ `docs/`, `tests/`, `__tests__`, `.env*.example`, `supabase/migrations_archive/`, dump-uri/backup-uri istorice și fixtures cu adrese fake de tip `@example.test`.
- **Backup / restore readiness (ops)**: `BACKUP-INSTRUCTIONS.md` este runbook-ul operațional curent; `.env.local.example` este inventarul versionat de env/secrets; `scripts/check-backup-readiness.mjs` verifică read-only că repo-ul are artefactele minime pentru restore auditabil (runbook, env inventory, `supabase/migrations/`, `supabase/functions/`, `vercel.json`, bucket-uri detectate din migrații și cron config), fără să pretindă backup automat de date.
- Restore realist astăzi: cod + migrații + env inventory din repo, dar datele reale (`public`, `auth.users`) și obiectele Storage rămân backup-uri separate provider/manual; pentru proiect nou Supabase lipsește încă `supabase/config.toml`, deci restore-ul nu este complet turnkey doar din repo.
- **Topologie staging separată (ops)**: există acum un proiect Supabase dedicat `zmeurelOS-staging` (`qinpqsqeaagjfobqwfwx`), separat de `zmeurelOS-dev` și `zmeurelOS-prod`; mapping-ul Vercel non-prod se face prin env-uri branch-specific pe `preview` pentru branch-ul `staging`, iar preview-ul stabil confirmat este `https://zmeurel-git-staging-zmeurelos-admins-projects.vercel.app`. Checkerul read-only `scripts/check-staging-readiness.mjs` / `npm run check:staging-readiness` validează această topologie; workspace-ul principal rămâne linked la dev, iar targeting-ul operațional pentru staging se face prin worktree separat + `supabase link` targetat, nu prin relink în directorul principal.
- **BottomTabBar mobil**: drawer-ul „Mai mult” se închide la navigare doar când `usePathname()` se schimbă efectiv (nu la re-randări cu același path). În Playwright, testele care apasă tab barul trebuie să permită hidratarea clientului după navigare (ex. `page.goto(..., { waitUntil: 'load' })` + buton vizibil), nu doar `domcontentloaded`.
- **Analytics admin / zgomot E2E**: `profiles.exclude_from_analytics` și `tenants.exclude_from_analytics` (migrare `20260402100000_analytics_exclude_test_accounts.sql`) — backfill pe `auth.users` cu email `*@example.test` (pattern folosit în toate spec-urile Playwright din repo). `loadAnalyticsDashboardData` și `refresh_tenant_metrics_daily` exclud aceste rânduri din KPI-uri și agregări zilnice. Reversibil în SQL. Preview read-only: `scripts/sql/analytics-exclude-test-accounts-preview.sql`.
- **Magazin fermier (public, client final)**: ` /magazin` — landing; `/magazin/[tenantId]` — catalog produse read-only (încărcare server cu `getSupabaseAdmin()` în `src/lib/shop/load-public-shop.ts`), coș în state local + **checkout light**: `POST /api/shop/order` (anonim, `validateSameOriginMutation`, `getSupabaseAdmin`) inserează una sau mai multe înregistrări în `comenzi` (status `noua`, `data_origin: magazin_public`, `produs_id` când există coloana), câte una per linie din coș. Endpointul are hardening anti-abuse server-side în `src/lib/api/public-write-guard.ts` (rate limit fixed-window + cooldown scurt pe fingerprint de payload) și întoarce `429` cu `Retry-After` când pragurile sunt depășite. După inserări reușite, `notifyFarmerShopOrder` (`src/lib/shop/notify-farmer-shop-order.ts`) poate trimite email fermierului prin **Resend** (HTTPS, fără dependență npm): destinatar = email din Auth pentru `tenants.owner_user_id`, sau override opțional `SHOP_ORDER_NOTIFY_EMAIL`; necesită `SHOP_ORDER_NOTIFY_FROM` + (`SHOP_ORDER_NOTIFY_RESEND_API_KEY` sau `RESEND_API_KEY`). Eșecul notificării este logat; răspunsul JSON de succes nu depinde de email. Proxy permite `pathname.startsWith('/api/shop')` fără autentificare. UI: `src/components/shop/FarmShopClient.tsx` (nu folosește AppShell ERP). Din ERP, modulul **Produse** (`ProdusePageClient`) expune „Vezi magazin” / „Copiază link magazin” folosind `tenantId` din `useDashboardAuth()` (fără fetch suplimentar); CTA-urile sunt dezactivate până există cel puțin un produs cu status „activ” (aliniat la vitrina publică).
- **Magazin asociație (public, multi-fermier)**: `/magazin/asociatie` — branding „Gustă din Bucovina” **doar** aici (layout + `src/styles/association-shop.css`, fonturi Baloo 2 / Inter în `src/app/magazin/asociatie/layout.tsx`); nu în ERP sau magazin fermier. Catalog: `loadAssociationCatalog` / `loadAssociationCatalogCached` (`src/lib/shop/load-association-catalog.ts`) — produse `status = activ` pentru tenants cu `tenants.is_association_approved = true` (setat din **Admin** → tabel tenanți, coloana „Magazin asociație”, API `PATCH /api/admin/tenant-association`, doar superadmin) **reunit** cu fallback temporar pe allowlist explicit în env: `ASSOCIATION_ALLOWED_OWNER_USER_IDS` (preferat, UUID-uri) și opțional `ASSOCIATION_ALLOWED_EMAILS` (legacy/tranziție). Fără fallback hardcodat în cod; fără filtru `is_demo`. UI: `AssociationShopClient.tsx` orchestrator + `src/components/shop/association/*` (header brand pe verde, hero, filtre + sortare client-side, carduri, detaliu dialog/sheet, coș drawer, checkout), `AssociationLogo.tsx`, `AssociationHeroVisual.tsx`, imagini produse cu `next/image` (`unoptimized` pentru URL storage); hero Unsplash în `next.config.js`. Landing comercial: trust în hero, secțiune „Cum funcționează”, grid, „Despre asociație” (valori) + footer; paletă (#0D6342 / #FF9E1B / #FFF9E3 / #F5EDCA / text #3D4543 / #6B7A72 / border #E8E0C4); coș grupat pe fermier; `POST /api/shop/order` per `tenantId`. Fără AppShell ERP.
- **Profil public producător editat din workspace-ul asociației**: în `/asociatie/producatori`, adminii/moderatorii pot edita `tenants.descriere_publica`, `specialitate`, `localitate` și `poze_ferma` direct din dialogul `ProducerProfileEditor`; API-urile sunt `PATCH /api/association/producer-profile` și `POST/DELETE /api/association/producer-photos`. Pozele fermei merg în bucket-ul public `producer-photos` (`storage.objects`), maxim 3 URL-uri per tenant. RLS pe `tenants` permite staff-ului asociației doar aceste câmpuri publice prin migrarea `20260405011_allow_profile_update.sql`, iar triggerul `enforce_tenants_assoc_admin_updates()` blochează modificarea altor coloane.
- **Catalog produse asociație (ERP)**: `/asociatie/produse` folosește acum tabel full-width + Sheet responsive unic pentru vizualizare/editare produs (`side="right"` pe `md+`, `side="bottom"` pe mobil), cu tab-uri „Preț & Vizibilitate” și „Informații alimentare”; „Elimină din catalog” face doar PATCH (`association_listed = false`, `association_price = null`), fără DELETE pe `produse`. Crearea nouă merge prin `POST /api/association/products/create` și inserează în `public.produse` pentru un fermier aprobat al asociației, cu TODO explicit despre vizibilitatea ulterioară în ERP-ul fermierului.
- **Setări asociație (branding public + piață)**: `/asociatie/setari` folosește `AssociationSettingsClient` + `PATCH /api/association/settings`; conținutul persistă în Storage privat (`association-config/settings.json`) prin `src/lib/association/public-settings.ts` și este citit pe landing-ul public `/magazin/asociatie` și pe profilul public al producătorului pentru descriere/program.
- `src/app/(dashboard)/layout.tsx` trusts proxy headers when present and initializes app providers.
- Most protected pages are thin route files that render client-side page components using React Query.
- Database access usually goes through `src/lib/supabase/queries/*.ts`.
- Weather data now follows a Supabase-backed cache flow: dashboard client -> `supabase.functions.invoke('fetch-meteo')` -> `supabase/functions/fetch-meteo` -> `meteo_cache` table -> OpenWeather fallback when cache is expired.

## Technology Stack

- Next.js `16.1.6`
- React `19.2.3`
- TypeScript `strict`
- Supabase SSR + Supabase JS v2
- TanStack Query v5
- Tailwind CSS v4
- shadcn/ui + Radix
- Zod
- Playwright
- Sentry

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

## UI System Rules

- Always use semantic tokens from `src/styles/theme.css` for colors, borders, focus, and surfaces.
- Always prefer existing primitives (`AppCard`, `MobileEntityCard`, `Badge`, `PageHeader`, `CompactPageHeader`, `KpiCard`, `ListSkeleton`).
- Never introduce hardcoded colors in component classes for status/surface/text meaning.
- Never create parallel light/dark logic in components; `next-themes` + `.dark` tokens remain the only theme system.
- Respect mobile-first constraints: predictable scan order, no card-in-card, minimal cognitive load.
- Status tones must be resolved through `src/lib/ui/theme.ts` (`getStatusToneTokens`).

### Desktop workspace (md+, fără regresii mobil)

- **Mobilul nu se schimbă** ca prim criteriu: split layout, panou inspector și toolbar desktop sunt **ascunse sub `md`** sau echivalent; `ResponsiveDataView` păstrează ramura mobilă (`md:hidden` cards).
- Primitive minime în `src/components/ui/desktop/`: `DesktopSplitPane`, `DesktopToolbar`, `DesktopInspectorPanel` (+ `DesktopInspectorSection`). Sidebar desktop (`src/components/layout/Sidebar.tsx`): grupul Fermă listează **Activități agricole** (`/activitati-agricole`) lângă Parcele / Recoltări / Culegători; **secțiunea colapsabilă „Administrare”** (Panou admin, Analytics, Audit) apare **doar** când `useDashboardAuth().isSuperAdmin` — același criteriu ca `src/app/(dashboard)/admin/layout.tsx`. BottomTabBar mobil rămâne sursă separată dar coerentă ca rută.
- **Comenzi** (`src/app/(dashboard)/comenzi/ComenziPageClient.tsx`) este modulul de referință pentru master–detail desktop (căutare în toolbar, `skipDesktopDataFilter` + `hideDesktopSearchRow` pe listă când filtrarea e în page). Dialogul Add/Edit comandă folosește `desktopFormWide`, secțiuni `FormDialogSection` și un **rezumat contextual lipit** (`aside` + `sticky`) doar pe `md+`; datele din panou sunt derivate live din formular (fără query nou). Comenzile cu `data_origin = magazin_public` afișează badge „Magazin”, filtre origine (Toate / Din magazin / Manuale), grupare euristică în listă (`src/lib/comenzi/magazin-groups.ts`: telefon + zi + origine) cu sortare și chenar stânga în tabel; inspector + `ViewComandaDialog` rezumă liniile aceluiași checkout.
- **Recoltări** (`src/app/(dashboard)/recoltari/RecoltariPageClient.tsx`) confirmă același pattern (toolbar + split + inspector); totaluri compacte în toolbar pe desktop, fără `StickyActionBar` pe `md+`. Dialoguri Add/Edit: layout în două coloane pe desktop (form secționat + rezumat live din state), coerent cu Comenzi/Cheltuieli.
- **Culegători** (`src/app/(dashboard)/culegatori/CulegatorPageClient.tsx`): același split + inspector pe desktop, tabel păstrat; detalii pe mobil rămân în `AppDialog` (deschis doar când viewport-ul nu e desktop). Dialoguri Add/Edit: form secționat + panou contextual dreapta pe `md+`, aliniat cu Recoltări/Comenzi.
- **Vânzări** (`src/app/(dashboard)/vanzari/VanzariPageClient.tsx`): dialoguri Add/Edit — `desktopFormWide` + `FormDialogSection` + aside previzualizare pe `md+` (total `cantitate × preț`, status, contor vânzări pe client din lista deja în cache, prop `tenantVanzari`).
- **Produse** (`src/app/(dashboard)/produse/ProdusePageClient.tsx`): catalog fermă — tabel + inspector desktop (`DesktopSplitPane`), toolbar cu filtre; Add/Edit produse cu aside previzualizare; fără query suplimentar pentru „vânzări per produs” până când `vanzari`/`comenzi` expun `produs_id` în cache-ul paginii.
- **Cheltuieli** (`src/app/(dashboard)/cheltuieli/CheltuialaPageClient.tsx`): split + inspector pe desktop, lățime `md:max-w-7xl`, totaluri filtru în `DesktopToolbar`; mobil: carduri expandabile neschimbate ca flux. **Formulare Add/Edit**: `AddCheltuialaDialog` / `EditCheltuialaDialog` folosesc `desktopFormWide` pe `AppDrawer`/`AppDialog` + `FormDialogSection` pentru secțiuni; lățimea mare și spațierea extra sunt doar de la `md+` (vezi `FormDialogLayout`).
- **Investiții** (`src/app/(dashboard)/investitii/InvestitiiPageClient.tsx`): același pattern desktop ca OPEX (toolbar cu total în filtru, split, inspector CAPEX); **formulare Add/Edit**: `desktopFormWide` + `FormDialogSection` + `DialogFormActions` în `AddInvestitieDialog` / `EditInvestitieDialog`, aliniat cu Cheltuieli; mobil neschimbat ca flux.
- **Stocuri** (`src/app/(dashboard)/stocuri/StocuriPageClient.tsx`): desktop `md+` — grilă **filtre stânga · tabel centru · inspector dreapta** (pattern filtre + tabel + inspector, fără `DesktopSplitPane`); căutare doar în `DesktopToolbar` + `skipDesktopDataFilter` / `hideDesktopSearchRow` pe `ResponsiveDataView`; inspector din agregare locală pe `stocuri` deja încărcate; mobil: același card de filtre deasupra listei ca înainte.
- **Setări** (`src/app/(dashboard)/settings/page.tsx`): *Settings Shell* desktop — grilă nav sticky + conținut, ancore `id` pentru subsecțiuni; componentă `src/components/settings/DesktopSettingsNav.tsx`; pe mobil layout-ul rămâne vertical.
- Reguli și exemple: `docs/ui/desktop-workspace.md`.
- **Admin analytics** (`/admin/analytics`): dashboard desktop-first; încărcare metrici în `src/lib/admin/analytics-dashboard-data.ts`, UI în `src/components/admin/analytics/`; filtre URL: `period` (`7d`|`30d`|`90d`), `demo` (`all`|`exclude_demo`|`demo_only`), plus filtre AI (`aiRange`, `aiFlow`, `aiDecisionMode`). Evenimentele AI (`ai_chat_decision`) se persistă în `analytics_events.event_data`. Secțiunea **Tech Health / Sentry** (final pagină) citește doar config/runtime (`getSentryTechHealth()` din `src/lib/monitoring/sentry-tech-health.ts`) — fără API Sentry, fără metrici live; link opțional `NEXT_PUBLIC_SENTRY_DASHBOARD_URL`. Instrumentare Next: **doar** `src/instrumentation.ts` și `src/instrumentation-client.ts`; release + sample rates centralizate în `src/lib/monitoring/sentry-runtime.ts`; `scripts/check-env.js` avertizează pe Vercel dacă lipsește `SENTRY_AUTH_TOKEN` (upload source maps).

## Coding Conventions Detected

- Use `@/*` imports mapped to `src/*`.
- User-facing copy is in Romanian.
- For new standardized mobile entity lists/cards, prefer `src/components/ui/MobileEntityCard.tsx`; keep page-level consumers data-driven and use the supported summary props (`mainValue`, `secondaryValue`, `statusLabel`, `meta`, `bottomSlot`) instead of ad-hoc children or container styling.
- Dashboard 2.0 logic is centralized in `src/lib/dashboard/engine.ts` and currently exposes `DashboardRawData`, `ParcelDashboardState`, `buildDashboardTasks`, `buildDashboardAlerts`, `buildDailySummary`, and `buildWeatherWindow` for gradual UI adoption.
- Client modules commonly use a React Query page-client pattern.
- Shared query keys live in `src/lib/query-keys.ts`.
- Browser Supabase access should go through `getSupabase()` in `src/lib/supabase/client.ts`.
- Server-side Supabase access should go through `createClient()` in `src/lib/supabase/server.ts`.
- Service-role access should be isolated to admin/API/cron/demo repair flows via `src/lib/supabase/admin.ts`.
- Tenant-aware query functions typically resolve tenant internally using `getTenantId(...)`.
- Canonical tenant destructive cleanup order now lives in `src/lib/tenant/destructive-cleanup.ts`, with named scopes (`farm_reset`, `gdpr_farm_delete`, `demo_tenant_cleanup`), critical vs optional targets, and post-delete verification on critical targets.
- Mutations often support backward-compatible fallback behavior for environments where some migrations are missing.
- Analytics must not block UX; tracking is fire-and-forget.
- Product analytics currently uses two helpers: legacy `src/lib/analytics/track.ts` and the more structured `src/lib/analytics/trackEvent.ts`; prefer the structured pattern for new work unless a task explicitly requires preserving legacy naming.
- The structured analytics taxonomy now centers on names such as `module_opened`, `form_started`, `form_completed`, `form_failed`, `entity_created`, `entity_updated`, `entity_deleted`, `import_completed`, `export_completed`, `search_performed`, `sync_completed`, and `sync_failed`.
- Query invalidation after mutations should follow existing `queryKeys` patterns instead of ad hoc cache updates.
- Prefer idle route prefetch for low-priority navigation warming; avoid eager mount-time prefetch on mobile-critical screens when it competes with real data loading.
- For real client-bundle attribution, use `ANALYZE=true npm run build`; the repo now has conditional bundle analyzer support in `next.config.js`.
- Financial category labels are centralized in `src/lib/financial/categories.ts` (exports `CATEGORII_CHELTUIELI`, `CATEGORII_INVESTITII`, `CHELTUIELI_LEGACY_MAP`, `INVESTITII_LEGACY_MAP`, `resolveCheltuialaCategorie`, `resolveInvestitieCategorie`). Always import from there — never hardcode category strings in UI or query code. `src/lib/supabase/queries/investitii.ts` re-exports `CATEGORII_INVESTITII` for backward compatibility.

## Critical Rules For Future Changes

- Never modify database schema without a new migration in `supabase/migrations/`.
- Respect authentication and callback flows in `src/proxy.ts` and `src/app/auth/callback/route.ts`.
- Respect tenant isolation at all times. Do not bypass or weaken RLS assumptions.
- Keep service-role usage minimal and server-only.
- Prefer minimal, local changes over large refactors.
- Keep new code consistent with existing module/query/component patterns.
- Preserve idempotency and offline sync semantics where `client_sync_id`, `sync_status`, or RPC upsert flows already exist.
- Keep the offline sync table allowlist in `src/lib/offline/syncables.ts` aligned with the SQL `upsert_with_idempotency` contract.
- Preserve analytics and monitoring hooks unless the task explicitly changes instrumentation.
- Pentru logare server-side în zone sensibile (AI chat, integrații, endpointuri publice), folosește helper-ele din `src/lib/logging/redaction.ts` (`sanitizeForLog`, `toSafeErrorContext`) și evită logarea inputului brut, tokenurilor, emailurilor, telefoanelor sau body-urilor externe complete.
- Keep client-side Sentry lean: Replay is opt-in via `NEXT_PUBLIC_SENTRY_REPLAY_ENABLED=true`, and non-essential client monitoring should prefer lazy/dynamic loading over root shared imports.
- Update the repository context docs incrementally when architecture, domain rules, or repo structure changes.

## Multi-Tenant And Auth Warnings

- Tenant identity is resolved primarily from `profiles.tenant_id`.
- `getTenantId(...)` throws when tenant context is missing. `getTenantIdOrNull(...)` is safer for server pages.
- `src/proxy.ts` injects `x-zmeurel-user-id`, `x-zmeurel-user-email`, and `x-zmeurel-tenant-id`.
- Many client query modules still explicitly filter by `tenant_id` even with RLS enabled. Keep that pattern.
- Sensitive routes use same-origin checks via `validateSameOriginMutation(...)`.

## Database And Migration Warnings

- The project depends on many Supabase SQL migrations, including RLS normalization, business ID generation, stock-safe RPCs, demo seeding, analytics, solar/culturi support, and tenant repair logic.
- Modulul `Tratamente & Fertilizare` are fundație DB paralelă cu `activitati_agricole`, `culture_stage_logs` și `etape_cultura`. Tabelele noi sunt `produse_fitosanitare`, `planuri_tratament`, `planuri_tratament_linii`, `parcele_planuri`, `stadii_fenologice_parcela`, `aplicari_tratament`; nu se rescriu flow-urile existente și nu se mută date din structurile vechi.
- CRUD-ul principal pentru planuri de tratament folosește acum wizard-ul `src/components/tratamente/plan-wizard/PlanWizard.tsx`, lista `/tratamente/planuri` și RPC-ul atomic `public.upsert_plan_tratament_cu_linii(...)`. Arhivarea este soft (`planuri_tratament.arhivat = true`), iar planurile arhivate nu mai trebuie oferite în fluxurile de asociere noi.
- Hub-ul global `/tratamente` agregă aplicările cross-parcel pentru intervalul curent (azi + 7 zile încărcate inițial), filtre locale pe parcelă/status, meteo deduplicat pe parcelă și quick actions care reutilizează server actions-urile din detaliul unei aplicări (`markAplicataAction`, `reprogrameazaAction`, `anuleazaAction`).
- Some query modules intentionally include compatibility fallbacks for partially migrated environments. Do not remove those without verifying schema parity in production.
- `src/lib/supabase/queries/parcele.ts` now includes a schema-compat select fallback (legacy columns + safe defaults for `rol`, `apare_in_dashboard`, `contribuie_la_productie`, `status_operational`) to keep `/dashboard` and `/parcele` usable when linked environments lag migrations.
- When adding new migrations, use a unique numeric timestamp prefix that matches Supabase CLI expectations exactly; avoid duplicate short versions like multiple `20260313_*` files.
- Deprecated duplicate migration files that intentionally preserve old SQL should be archived outside `supabase/migrations/` (for example in `supabase/migrations_archive/`) so the active migration chain contains exactly one file per version.
- For critical RPC/function migrations that have to be pushed to linked environments, prefer smaller files with one major function/grant unit instead of bundling several `create or replace function` definitions into one pending migration.
- Generated types are in `src/types/supabase.ts`; `src/lib/supabase/types.ts` may exist as a thin re-export shim for module-local imports, but it is not the source of truth.
- `generate_business_id(...)` has a local migration fix plus a client-side duplicate fallback because linked environments may still return repeated values until the repaired RPC is applied everywhere.
- `cheltuieli_diverse.metoda_plata` is now part of the intended runtime schema, but cheltuieli reads/writes still include compatibility fallbacks for environments where that column is not live yet.
- `analytics_events` is now present in `src/types/supabase.ts`, but the linked Supabase project still reflects the common runtime subset (`event_name`, `event_data`, `module`, `page_url`, `status`, `session_id`) rather than the fuller local analytics migration intent.
- Local migration history remains the source of truth, but analytics runtime code is intentionally aligned to the shared subset until the pending remote migration chain is repaired and applied cleanly.
- `types/database.types.ts` exists as a legacy manual type file and should not be treated as the source of truth.

## AI Chat Widget — Source of Truth & Current State

### Runtime Source of Truth Files:
- `src/app/api/chat/route.ts` — wrapper-ul endpoint-ului POST pentru Next.js App Router + guard `validateSameOriginMutation` (same-origin/CSRF)
- `src/app/api/chat/chat-post-handler.ts` — orchestratorul principal al logicii AI chat, rate limiting, keyword queries și handoff UI
- `src/app/api/chat/contract-helpers.ts` — parsare/validare open_form cu Zod, contracte structured output pentru flow-urile țintite și validare `prefill_data`
- `src/app/api/chat/extractors.ts` — extractorii regex/text pentru sume, date, parcele, produse, clienți, doze și observații
- `src/app/api/chat/signal-detectors.ts` — detectorii booleeni pentru întrebări, costuri, recoltare, activități, comenzi, clienți, investiții și corecții explicite
- `src/app/api/chat/conversation-memory.ts` — memorie conversațională scurtă și loader-ul pentru ultimele schimburi
- `src/app/api/chat/date-helpers.ts` — helperii canonici pentru date relative în timezone `Europe/Bucharest`
- `src/app/api/chat/flow-detection.ts` — tipurile/constantele de flow, mesajele friendly, canonicalizarea și încărcarea candidaților tenant
- `src/app/api/chat/utils.ts` — utilitare comune pentru parsing/canonicalizare/error summaries
- `src/lib/financial/chat-router.ts` — routing deterministic OPEX/CAPEX (zero LLM cost)
- `src/components/ai/AiBottomSheet.tsx` — UI chat (bottom sheet cu dicție voice și prefill)
- `src/components/ui/AiFab.tsx` — buton flotant pentru mobile
- `supabase/migrations/20260323_ai_conversations.sql` — tabel memorie conversații
- `docs/ai-chat-widget.md` — documentație detaliată

### Ce știe AI-ul acum:
- **Răspunsuri în română** prin Gemini 2.5-flash (fallback gemini-2.0-flash-lite)
- **Detecție intenție creare** fără LLM: `adaugă/creează/înregistrează/pune/bagă/trece`
- **Routing financiar deterministic**: regex pentru OPEX vs CAPEX (ex: motorină→cheltuială, butași→investiție)
- **4 formulare precompletate**:
  - `cheltuiala` (OPEX) — cu categoriile standardizate
  - `investitie` (CAPEX) — cu categoriile standardizate
  - `recoltare` — cantitate_kg, parcela, data
  - `activitate` — tip, produs, doza, parcela, data
- **Structured extraction hibridă pentru flow-urile țintite (`recoltare`, `activitate`, `comandă`)**:
  - LLM-ul (prin Vercel AI SDK + Zod) decide flow-ul și extrage semantic datele din mesaj
  - Backend-ul validează strict output-ul, verifică ID-urile în entitățile injectate, decide clarificările și construiește un singur `prefill_data`
  - UI-ul consumă `prefill_data` ca sursă unică; cardul AI ascunde raw IDs, iar dialogurile folosesc direct `parcela_id` / `client_id` când sunt disponibile
- **Memorie conversație**: ultimele 3 schimburi din `ai_conversations`, injectată doar când detectează continuare (`și`, `mai devreme`, `continuă`)
- **Dictare voice**: Web Speech API `ro-RO`
- **Rate limit**: 20 mesaje/zi/user în `profiles.ai_messages_count` (override privilegiat pentru `profiles.is_superadmin = true` și, opțional, pentru user IDs din `AI_CHAT_PRIVILEGED_USER_IDS`; pragul privilegiat se configurează cu `AI_CHAT_PRIVILEGED_DAILY_LIMIT`, default 60)
- **Keyword context queries** (doar când se potrivesc):
  - `tratament` → ultimele activități agricole
  - `client` → căutare client după nume
  - `cheltuieli` → sumă lună curentă
  - `recoltare` → total kg lună curentă
  - `comenzi` → count by status
  - `stocuri` → ultimele mișcări stoc
- **Sugestii rapide** per rută (/cheltuieli, /investitii, etc.)
- **Analytics**: `analytics_events` după fiecare mesaj

### Optimizări token cost implementate:
- **Simple requests** cu `thinkingBudget: 0` pentru cereri simple
- **Deterministic routing** pentru financial (zero LLM cost)
- **Keyword queries** doar când regex se potrivește
- **Memorie** injectată doar când detectează continuare conversație
- **Output token cap** (default 220)
- **Minimal context injection**
- **Dual-model**: model simplu pentru cereri simple, model complet pentru restul

### Validare și clarificări îmbunătățite (2025-03-25):
- **Câmpuri obligatorii reale (form/save)**:
  - Cheltuială: `suma_lei`, `categorie`, `data`
  - Investiție: `suma_lei`, `categorie`, `data`
  - Activitate: `tip_activitate`, `data_aplicare`
  - Recoltare: `data`, `parcela_id`, `culegator_id`
  - Comandă: `cantitate_kg > 0`, `pret_per_kg > 0`
  - Client: `nume_client`
- **Matrice AI pentru clarificări/open_form (cheap-first)**:
  - AI întreabă strict lipsurile obligatorii pentru deschiderea flow-ului: activitate (`tip`, `data`), recoltare (`parcela`, `data`), cheltuială (`suma`, `data`, `categorie`), investiție (`suma`, `data`, `categorie`), comandă (`nume_client`, `cantitate_kg`, `data_livrare`), client (`nume_client`).
  - Câmpurile opționale (telefon, observații, produs/doză/sursă etc.) nu blochează deschiderea formularului.
- **Separare open vs save hint (2026-03-25)**:
  - `required_for_open_form` rămâne strict pentru viteză (nu blochează pe câmpuri opționale).
  - `required_for_save_hint` adaugă doar informare scurtă după deschiderea formularului, când mai lipsesc câmpuri relevante la salvare (ex: recoltare → culegător, comandă → preț/kg).
- **Clarificări scurte și precise**: "Ce sumă?", "La ce parcelă?", "Pentru ce dată?", "Ce produs?", "Care client?"
- **Reducere ghicit**: AI nu mai completează câmpuri critice din presupuneri nesigure
- **Validare strictă**: `contract-helpers.ts` validează câmpurile obligatorii cu Zod
- **Mesaj de eroare îmbunătățit**: când JSON open_form e invalid, AI cere detalii clare
- **Hotfix clasificare (2026-03-25)**:
  - Lucrările agricole/recoltarea au prioritate peste routing-ul financiar când mesajul indică operațiune agricolă.
  - Semnalele de cost (`sumă`, `lei`, `am plătit`, `factură`, etc.) sunt necesare pentru clasificare financiară deterministică.
  - Follow-up-ul cere strict câmpurile lipsă, fără a repeta câmpuri deja extrase (ex: parcela).
- **Hotfix continuitate multi-turn scurt (2026-03-25)**:
  - Răspunsurile scurte (`ieri`, `20 kg`, `0,5 l`, `Maria`, `Delniwa`) sunt tratate ca completări pentru flow-ul pending când AI tocmai a cerut clarificări sau a confirmat `formular pregătit`.
  - Contextul utilizatorului este fuzionat incremental între pași, ca să nu se piardă câmpurile deja extrase.
  - Detecția de clarificare pending acoperă și formulări de tip `mai am nevoie de...` / `ce detaliu mai completezi?`, pentru a evita resetul la follow-up-uri scurte.
- **Hotfix canonicalizare entități (2026-03-25)**:
  - Valorile extrase pentru `parcela/sursa/nume_client/produs` sunt normalizate la etichete canonice din datele reale tenant când există un match sigur.
  - În caz de ambiguitate reală, AI cere clarificare scurtă contextuală, fără ghicit.
- **Normalizare română deterministică (2026-03-25)**:
  - Parserele locale acceptă forme uzuale: `20 de kg`, `20 kile`, `20 kilograme`, `300 de lei`, `jumate de litru`, `o jumătate de litru`, `500 ml`.
  - Date relative acceptate explicit: `azi`, `astăzi`, `ieri`, `alaltăieri`, `mâine`, `poimâine`.
- **Hotfix routing prioritar (2026-03-25)**:
  - Prioritate deterministică pe semnal dominant: `recoltare` > `activitate agricolă` > `cheltuială`.
  - În ambiguitate reală între flow-uri apropiate (ex: produs + parcelă fără verb clar), AI cere clarificare scurtă contextuală, fără clasificare agresivă greșită.
- **Harness regresii AI chat (2026-03-25)**:
  - Harness-ul sintetic rapid rulează prin `npm run test:ai-chat` (config dedicat: `playwright.ai-chat.config.ts`).
  - Corpusul sintetic V2.6 acoperă acum pe categorii: routing clar, ambiguități controlate, continuitate multi-turn scurtă, corecții explicite, anulări explicite de câmp, canonicalizare/typo/nume apropiate, română reală/colocvială/dictare, `required_for_open_form`, `required_for_save_hint`, clarificări strict pe lipsuri reale, cazuri foarte scurte/sub-specificate și non-regresie pe flow-urile stabile.
  - Acoperă routing, follow-up scurt, entity locking/corecții, anulări explicite, ambiguități controlate, `required_for_open_form` și `required_for_save_hint`, cu focus pe româna reală a fermierului și failure modes probabile.
  - Contract tests endpoint real: `npm run test:ai-chat:integration` acoperă `POST /api/chat` (handler real cu mock-uri locale pentru auth/supabase/telemetry/memory), fără browser și fără DB real.
  - Gate standard înainte de deploy pentru patch-uri AI: `npm run check:ai-chat` (lint + typecheck + harness sintetic).
  - CI gate dedicat: workflow `.github/workflows/ai-chat-gate.yml` rulează `npm run check:ai-chat:ci` pe `pull_request`, `push` pe `main` (cu path filters AI/chat relevanți) și `workflow_dispatch`.
  - `check:ai-chat:ci` păstrează verificările rapide existente (`lint:ai-chat` + `typecheck` + harness sintetic) și adaugă `npm run test:critical:integration`, astfel regresiile importante din `POST /api/chat` sunt blocate automat doar pentru schimbările AI/chat relevante.
  - Orice bug nou descoperit pe AI chat trebuie adăugat întâi ca regresie în corpusul sintetic, apoi reparat.
  - Regression gate cross-modul (default înainte de build): `npm run test:critical` (hardening API/security stabile), iar `npm run check` include acum `npm run check:critical` înainte de `build`.
  - Pentru verificare extinsă (înainte de release): `npm run test:critical:full` (include și `test:ai-chat:integration`).
- **Observabilitate structurală minimă (2026-03-26)**:
  - Nu se loghează mesajul brut al utilizatorului în analytics-ul de decizie; payload-ul rămâne structural și scurt.
  - În development există un debug log server-side scurt (`[chat] decision`) cu aceleași metadate structurale, fără text brut.
  - Admin analytics reutilizează acum aceste evenimente direct în `src/components/admin/AnalyticsDashboard.tsx` pentru o secțiune AI cu KPI-uri, distribuții pe flow/decision mode, fricțiune/clarificări, save hints, usage LLM și tabel recent, filtrabile pe interval, flow și decision mode.
- **Hotfix routing financiar ambalaje (2026-03-27)**:
  - `caserole` este tratat explicit de routerul financiar deterministic ca `cheltuială -> Ambalaje`, deci cereri de tip `Adaugă o cheltuială de 300 lei pentru caserole, pentru azi` deschid direct formularul corect.
  - Extracția locală de `descriere` pentru cheltuieli/investiții acceptă acum și valori scurte valide dintr-un singur cuvânt (`motorină`, `manoperă`, `caserole`) când curățarea lasă un singur termen util.
  - În fallback-ul deterministic, când `routeFinancialMessage(...)` clasifică explicit mesajul ca `investiție`, ramura `cheltuială` nu mai preia cazul doar pe baza semnalului generic de cost (`lei`/`sumă`), evitând clarificări greșite de tip OPEX.
  - Filtrul anti-zgomot pentru `descriere` folosește detectare Unicode-safe pentru tokeni de o literă, astfel termeni validați cu diacritice (ex: `butași`) nu mai sunt eliminați fals.
- **Hotfix continuitate clarificări rapide (2026-03-27)**:
  - `AiBottomSheet` trimite acum și `conversationId` + `history` (ultimul exchange user/AI) către `POST /api/chat`, pe lângă `{ message, pathname }`.
  - Handler-ul citește `history` și îl folosește strict ca fallback pentru `continuation` când ultimul exchange nu este încă disponibil în `ai_conversations` (ex: follow-up foarte rapid: `ieri`, `300 lei`, `caserole`).
  - Resetul de context client se face la schimbarea de rută, păstrând izolare pe `pathname`.
- **Hotfix fallback deterministic după structured failure (2026-03-27)**:
  - Dacă `generateObject` eșuează pe flow-urile țintite (`recoltare`, `activitate`, `comandă`), handler-ul continuă acum pe parsarea deterministică locală în loc să răspundă imediat cu mesajul generic `Nu am reușit să extrag toate detaliile`.
  - Extracția deterministică de parcelă acceptă și formulări cu `din` (ex: `Am recoltat 20 kg azi din Delniwa`), astfel mesajele explicite de recoltare pot deschide formularul corect chiar și când structured extraction cade.
- **Hotfix comandă client raw + `pt` shorthand (2026-03-27)**:
  - Extracția deterministică pentru `comanda.nume_client` acceptă și abrevierea uzuală `pt` (ex: `Fă o comandă pt Matia 5 kg azi`).
  - În flow-ul `comandă`, dacă numele clientului este extras clar dar canonicalizarea nu are un match suficient de sigur, backend-ul păstrează `nume_client` raw în `prefill_data` în loc să repete clarificarea pentru același client.
  - Auto-legarea canonică pentru clienți rămâne permisă doar pe match exact sau prefix clar; fuzzy match-uri slabe de tip `Matia -> Maria` nu mai selectează clientul greșit.
- **Hotfix preț negociat client + reset explicit de flow (2026-03-27)**:
  - În `comandă`, dacă clientul este rezolvat canonic (`client_id`) și mesajul nu conține deja `pret_per_kg`, backend-ul completează acum automat prețul negociat din `clienti.pret_negociat_lei_kg` în `prefill_data`.
  - Dacă ultimul răspuns AI a fost deja `formular pregătit`, iar utilizatorul trimite o nouă intenție explicită de creare pe flow-urile non-agricole (`cheltuială`, `investiție`, `comandă`, `client`), contextul anterior nu mai este refolosit automat; mesajul este tratat ca flow nou.
  - Guard-ul de reset rămâne intenționat exclus pentru `recoltare` și `activitate`, ca să nu afecteze continuitatea lor stabilizată.
- **Hotfix continuitate clarificări financiare ambigue (2026-03-27)**:
  - Clarificările de tip `CAPEX sau OPEX?` sunt tratate acum ca `pending clarification`, deci răspunsuri scurte precum `capex` / `opex` se leagă de ultimul mesaj financiar relevant.
  - Pentru astfel de follow-up-uri, backend-ul păstrează contextul anterior în `effectiveMessage`, dar suprascrie flow-ul activ cu alegerea explicită a utilizatorului, ca să nu rămână blocat pe sticky-flow-ul anterior.
  - Routerul financiar deterministic rezolvă acum explicit cazurile `capex + pompă/atomizor/utilaj` și `opex + pompă/atomizor/utilaj`, păstrând suma/data/descrierea din pasul anterior.
- **Hotfix confirmare directă în AiBottomSheet (2026-03-27)**:
  - Butonul `Confirmă` din `AiBottomSheet` încearcă acum direct-save pentru `cheltuială`, `investiție` și `comandă`, folosind helper-ele runtime existente din `src/lib/supabase/queries/*`.
  - Pentru `comandă`, `AiBottomSheet` încearcă să rezolve clientul și datele auxiliare din `clienti` înainte de insert; dacă lipsesc încă datele critice, cade pe dialogul UI cu `openForm`.
  - Pentru `recoltare`, `AiBottomSheet` încearcă doar rezolvarea parcelei; dacă lipsește `culegator_id` sau alt câmp obligatoriu real, cade intenționat pe formularul UI.
  - `activitate` și `client` rămân UI-first; nu se salvează direct din chat.
- **Polish widget AI + dark mode (2026-03-28)**:
  - `AiFab` afișează acum un tooltip de onboarding `Întreabă-mă orice 🌱` doar la prima apariție per sesiune și are etichetă vizuală permanentă `AI` sub icon.
  - `AiFab` și `AiBottomSheet` folosesc paleta light/dark a aplicației; evită fundaluri hardcodate deschise când tema este `dark`.
  - Confirmările reușite din `AiBottomSheet` emit acum și feedback haptic scurt (`navigator.vibrate(10)` când este disponibil).
- **Praguri beta AI în admin analytics (2026-03-26)**:
  - Secțiunea AI are acum semnalizare simplă `Bun / Atenție / Risc` pentru KPI-urile cheie (`llm_fallback_rate`, `clarification_rate`, `open_form_rate`, `save_hint_rate`, `continuation_rate`).
  - Pragurile sunt locale în dashboard, orientative pentru hardening beta (nu SLA final enterprise), plus rezumat „Necesită atenție acum”.
- **Stabilization cleanup intern (2026-03-26)**:
  - `route.ts` a primit doar cleanup local (fără schimbare intenționată de comportament): helper pentru clarificări de ambiguitate, centralizare map `required_for_save_hint` și helper unificat pentru calculul câmpurilor `missing`.
  - Nomenclatura internă pentru flow keys / decision metadata rămâne aceeași la runtime; cleanup-ul reduce duplicarea și riscul de drift la patch-uri viitoare.
- **Hotfix flow break + clarificări curate (2026-03-26)**:
  - Când există clarificare/pending flow activ, follow-up-urile scurte valide (`ieri`, `20 kg`, `0,5 l`, nume scurt, telefon) rămân pe flow-ul curent.
  - Dacă mesajul nou exprimă clar o intenție diferită (ex: `recoltare -> activitate`, `recoltare -> comandă`), sticky flow-ul anterior este întrerupt și mesajul este re-evaluat ca cerere nouă.
  - Clarificările nu mai injectează text brut neverificat pentru entități nerezolvate; dacă nu există match canonic sigur, formularea rămâne neutră (ex: `Nu găsesc parcela în datele fermei. La ce parcelă te referi?`).
- **Hotfix recoltare parcel matching + prefill UI (2026-03-26)**:
  - Matching-ul pentru `recoltare.parcela` folosește acum `nume_parcela/nume` plus alias-uri din `soi_plantat/soi/cultura/tip_fruct`, cu normalizare și typo tolerance mică.
  - Alias-urile decorative de tip `(...Camp/Solar...)` sunt acceptate și mapate la valoarea canonică a parcelei.
  - `open_form` recoltare este aplicat coerent în UI: dialogul precompletează `parcela_id` (din textul AI), `kg_cal1` (din `cantitate_kg`) și `data`.
- **Hotfix activitate parcel/product matching + prefill UI (2026-03-26)**:
  - Matching-ul pentru `activitate.parcela` folosește aceeași strategie de alias/canonicalizare ca recoltare (`nume_parcela/nume`, `soi_plantat/soi`, `cultura/tip_fruct`, alias fără sufix, typo tolerance mică).
  - Matching-ul pentru `activitate.produs` folosește candidați tenant combinați din `activitati_agricole.produs_utilizat`, `comenzi.produs` și `miscari_stoc.produs`; la ambiguitate sau lipsă de match cere clarificare scurtă și curată.
  - `open_form` activitate este aplicat coerent în UI: dialogul precompletează `tip_activitate`, `parcela_id`, `produs_utilizat`, `doza`, `data_aplicare`.
- **Hotfix comandă client/product matching + prefill UI (2026-03-26)**:
  - Matching-ul pentru `comanda.nume_client` folosește canonicalizare pe date reale tenant (normalizare fără diacritice, prefix relevant, typo tolerance mică), cu clarificare doar la ambiguitate reală.
  - Matching-ul pentru `comanda.produs` folosește candidați tenant din `comenzi.produs` + `miscari_stoc.produs`; dacă nu există match sigur, AI cere clarificare curată și nu inventează.
  - `open_form` comandă include `client_id` când clientul e rezolvat canonic, iar UI auto-selectează clientul și aplică telefon/adresă din client când există.
- **Hotfix extraction hygiene leftover/observații (2026-03-26)**:
  - Există un strat unificat de curățare pentru text rezidual înainte de mapare la `observatii`/`descriere`.
  - `observatii` nu mai este fallback automat pentru text neînțeles; se completează doar când rămâne o notă clară, utilă și ne-dublată față de câmpurile deja extrase.
  - Zgomotul gramatical/politețurile și fragmentele fără valoare operațională sunt eliminate conservator.
- **Hotfix canonical prefill parity end-to-end (2026-03-26)**:
  - Pentru `recoltare`, `activitate`, `comanda`, aceeași structură `prefill` canonică este folosită în cardul AI, handoff URL și aplicarea din dialog.
  - Valorile brute nesigure sunt filtrate înainte de emiterea `open_form`; cardul nu mai trebuie să afișeze câmpuri ca „rezolvate” dacă nu sunt canonice.
  - În `comanda`, nota de livrare rămâne în observații și nu mai intră în `produs`.
- **Refactorizare controlată structured outputs (2026-03-26)**:
  - Pentru `recoltare`, `activitate`, `comandă`, interpretarea semantică principală nu mai stă în regex/fuzzy matching local, ci în structured outputs Zod pe modelul existent.
  - Contextul LLM injectează explicit `now_iso` și timezone `Europe/Bucharest`, plus doar entitățile valide relevante pentru flow-ul probabil.
  - `prefill_data` este acum payload-ul canonic backend -> card AI -> handoff URL -> dialog; aliasul vechi `prefill` rămâne doar pentru compatibilitate locală/teste.
- **Handoff backend→UI completat pentru flow-uri non-financiare (2026-03-26)**:
  - `open_form` pentru `recoltare`, `activitate`, `comanda`, `client` este consumat explicit în page-client-urile dedicate, cu deschiderea formularului și prefill coerent.
  - `AiBottomSheet` trimite acum query params compleți pentru aceste flow-uri la navigare.
  - Confirmarea directă din chat nu mai salvează `activitate`; fluxul rămâne confirmare finală în formularul UI.

### Limitele reale curente:
- Formulare AI suportate în handoff: `cheltuiala`, `investitie`, `recoltare`, `activitate`, `comanda`, `client` (lipsesc încă: vanzari, culegători, etc.)
- Parsare open_form doar prin JSON embedded în răspuns
- Acțiunile directe în DB din AI există doar după confirmare explicită în `AiBottomSheet`, pentru flow-urile unde payload-ul este deja suficient (`cheltuială`, `investiție`, unele `comenzi`); altfel fluxul cade pe formularul UI
- Înțelegere română încă limitată (regex simple, nu înțelegere semantică profundă)
- Căutare de date limitată (doar keyword queries simple)
- Fără editare înregistrări existente
- Fără rapoarte personalizate
- Memorie scurtă (ultimele 3 schimburi)
- Fără fallback offline
- Fără învățare din preferințele utilizatorului

### Ce facem prima dată după reset (ordine optimă):
1. **Extindere formulare**: comenzi, clienți
2. **Îmbunătățire înțelegere română**: +50 expresii uzuale, recunoaștere nume parcele
3. **Editare simplă**: "modifică cheltuiala X" → deschide formular cu datele existente
4. **Sugestii contextuale avansate**: bazate pe ce vede utilizatorul pe ecran
5. **Rapoarte simple**: "cât am recoltat săptămâna asta" → query + răspuns sumar

### Ghid pentru taskuri viitoare AI:
- **Pornește de la fișierele source of truth enumerate mai sus**
- **Verifică întotdeauna** `route.ts`, `chat-post-handler.ts`, `contract-helpers.ts`, `flow-detection.ts`, `extractors.ts`, `chat-router.ts`, `AiBottomSheet.tsx`
- **Actualizează incremental** documentația (`AGENTS.md` și `docs/ai-chat-widget.md`) când schimbi comportamentul AI
- **Păstrează optimizările token cost** existente
- **Nu bypass strict `open_form` validation**
- **Nu reintroduce long memory/prompt bloat** fără justificare clară

### Configurație:
- Main model: `AI_GEMINI_MODEL` (fallback in code: `gemini-2.5-flash`)
- Optional simple model: `AI_GEMINI_SIMPLE_MODEL` (fallback safe to main model)
- Rate limit: `AI_CHAT_DAILY_LIMIT` (default 20) messages/day/user, cu override runtime pentru superadmin + allowlist `AI_CHAT_PRIVILEGED_USER_IDS` (limită: `AI_CHAT_PRIVILEGED_DAILY_LIMIT`, default 60)
- Output token cap: `AI_CHAT_MAX_OUTPUT_TOKENS` (conservative default in code)
- Usage logging toggle: `AI_CHAT_USAGE_LOG=true`
- Required env vars: `GOOGLE_GENERATIVE_AI_API_KEY`, `AI_GEMINI_MODEL`, `AI_CHAT_DAILY_LIMIT` (opțional: `AI_CHAT_PRIVILEGED_USER_IDS`, `AI_CHAT_PRIVILEGED_DAILY_LIMIT`)

## Sensitive Systems

- Auth callback and onboarding repair
- Tenant isolation and RLS
- Service-role API routes
- GDPR delete/reset endpoints
- Demo tenant seeding/reload/cleanup
- Offline sync queue and idempotent create flows
- Stock-affecting RPCs for harvests, orders, and sales
- Google Contacts integration code and encrypted OAuth tokens (`GOOGLE_TOKENS_ENCRYPTION_KEY`, server-only)
- Admin plan management and superadmin gating

## Practical Guidance For AI Agents

- Before changing business logic, inspect the matching module query file in `src/lib/supabase/queries/`.
- Before changing destructive flows, inspect related API routes under `src/app/api/`.
- Before changing auth or onboarding, inspect `src/proxy.ts`, `src/app/auth/callback/route.ts`, `src/lib/auth/ensure-tenant.ts`, and `src/lib/tenant/get-tenant.ts`.
- Before changing parcel/solar logic, inspect both parcel UI components and `src/lib/parcele/crop-config.ts`.
- `tip_unitate` currently supports `camp`, `solar`, `livada`, and `cultura_mare`; in Activități Agricole, `cultura_mare` must use only: `Arat`, `Discuit`, `Semănat`, `Erbicidat`, `Stropit`, `Recoltat`, `Irigat`.
- For `solar` units, creation/edit modal flows now capture base parcel metadata only; crop assignment and lifecycle management live in Solar Details (`src/app/(dashboard)/parcele/[id]/page.tsx`).
- Before changing stock or fulfillment, inspect RPC-backed query files for `recoltari`, `vanzari`, `comenzi`, and `miscari-stoc`.
- Before changing stock reporting or audit recommendations, inspect `src/app/(dashboard)/rapoarte/*`, `src/lib/calculations/stock-audit.ts`, and `src/lib/supabase/queries/miscari-stoc.ts` together.
- Stock-audit thresholds are centralized in `src/lib/calculations/stock-audit-thresholds.ts`; keep UI labels and audit rules aligned with these constants.
- Multi-granular stock reporting now also uses `src/lib/calculations/stock-reporting.ts`. Preserve the rule that reports must never infer a finer grain (soi/locație) than the source data actually provides.
- For cheltuieli/investiții, keep the simplified universal taxonomy:
  - OPEX: `Îngrășăminte`, `Tratamente fitosanitare`, `Ambalaje`, `Forță de muncă`, `Combustibil / energie`, `Consumabile`, `Transport`, `Reparații / întreținere`, `Servicii`, `Altele`
  - CAPEX: `Material săditor`, `Irigații`, `Sisteme de susținere`, `Construcții`, `Echipamente / utilaje`, `Depozitare`, `Infrastructură`, `Solarii / sere`, `Îmbunătățiri teren`, `Altele`
- Before changing demo flows, inspect `src/lib/demo/*` and related API routes.
- Before changing settings/GDPR/admin behavior, inspect the associated API routes for same-origin, service-role, and protected-account logic.
- Before changing analytics, inspect `src/lib/analytics/track.ts`, `src/lib/analytics/trackEvent.ts`, `src/components/app/PageViewTracker.tsx`, `src/components/admin/AnalyticsDashboard.tsx`, and the `analytics_events` / `tenant_metrics_daily` migrations together.

## Incremental Context Rule

When future prompts modify architecture, domain logic, repository structure, or critical flows, update:

- `AGENTS.md`
- `docs/PROJECT_CONTEXT.md`
- `docs/CODE_STRUCTURE.md`
- `docs/DOMAIN_RULES.md`
- `docs/KNOWN_RISKS.md`

## Testare E2E Checkout

Testul E2E acoperă fluxul complet al magazinului public:
produse → coș → checkout → comandă → DB assertions.

**Rulare locală:**
`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \`
`NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key> \`
`SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \`
`npm run test:e2e:checkout`

**Mock-uri necesare:** fără `RESEND_API_KEY` și fără VAPID keys în env
— outbound-urile server-side sunt dezactivate automat dacă lipsesc cheile.

**Assertions DB verificate:** `comenzi` (`status=noua`), `message_log`, `consent_events`.

**CI:** rulează automat în `e2e-checkout.yml` la push/PR pe `main`.

## Testare RLS

Testele RLS verifică izolarea cross-tenant la nivel de bază de date, nu la nivel de cod TypeScript. Mock-urile nu sunt suficiente pentru acest scop — un mock care returnează `[]` trece indiferent de politicile RLS.

**Tabele acoperite:** `parcele`, `comenzi`, `produse`, `miscari_stoc`, `profiles`

**Rulare locală:**
`supabase start`
`SUPABASE_TEST_URL=http://127.0.0.1:54321 \`
`SUPABASE_TEST_ANON_KEY=<anon-key-din-supabase-status> \`
`SUPABASE_TEST_SERVICE_ROLE_KEY=<service-role-din-supabase-status> \`
`npm run test:rls`

**CI:** rulează automat în `rls-tests.yml` la push/PR pe `main`.

Update them incrementally. Do not rewrite them from scratch unless the repository changes substantially.- **Nu mai este nevoie de scanare completă de repo** pentru taskuri AI
- **Pornește de la fișierele source of truth enumerate mai sus**
- **Verifică întotdeauna** `route.ts`, `contract-helpers.ts`, `chat-router.ts`, `AiBottomSheet.tsx`
- **Actualizează incremental** documentația (`AGENTS.md` și `docs/ai-chat-widget.md`) când schimbi comportamentul AI
- **Păstrează optimizările token cost** existente
- **Nu bypass strict `open_form` validation**
- **Nu reintroduce long memory/prompt bloat** fără justificare clară

### Configurație:
- Main model: `AI_GEMINI_MODEL` (fallback in code: `gemini-2.5-flash`)
- Optional simple model: `AI_GEMINI_SIMPLE_MODEL` (fallback safe to main model)
- Rate limit: `AI_CHAT_DAILY_LIMIT` (default 20) messages/day/user, cu override runtime pentru superadmin + allowlist `AI_CHAT_PRIVILEGED_USER_IDS` (limită: `AI_CHAT_PRIVILEGED_DAILY_LIMIT`, default 60)
- Output token cap: `AI_CHAT_MAX_OUTPUT_TOKENS` (conservative default in code)
- Usage logging toggle: `AI_CHAT_USAGE_LOG=true`
- Required env vars: `GOOGLE_GENERATIVE_AI_API_KEY`, `AI_GEMINI_MODEL`, `AI_CHAT_DAILY_LIMIT` (opțional: `AI_CHAT_PRIVILEGED_USER_IDS`, `AI_CHAT_PRIVILEGED_DAILY_LIMIT`)

## Sensitive Systems

- Auth callback and onboarding repair
- Tenant isolation and RLS
- Service-role API routes
- GDPR delete/reset endpoints
- Demo tenant seeding/reload/cleanup
- Offline sync queue and idempotent create flows
- Stock-affecting RPCs for harvests, orders, and sales
- Google Contacts integration code and encrypted OAuth tokens (`GOOGLE_TOKENS_ENCRYPTION_KEY`, server-only)
- Admin plan management and superadmin gating

## Practical Guidance For AI Agents

- Before changing business logic, inspect the matching module query file in `src/lib/supabase/queries/`.
- Before changing destructive flows, inspect related API routes under `src/app/api/`.
- Before changing auth or onboarding, inspect `src/proxy.ts`, `src/app/auth/callback/route.ts`, `src/lib/auth/ensure-tenant.ts`, and `src/lib/tenant/get-tenant.ts`.
- Before changing parcel/solar logic, inspect both parcel UI components and `src/lib/parcele/crop-config.ts`.
- `tip_unitate` currently supports `camp`, `solar`, `livada`, and `cultura_mare`; in Activități Agricole, `cultura_mare` must use only: `Arat`, `Discuit`, `Semănat`, `Erbicidat`, `Stropit`, `Recoltat`, `Irigat`.
- For `solar` units, creation/edit modal flows now capture base parcel metadata only; crop assignment and lifecycle management live in Solar Details (`src/app/(dashboard)/parcele/[id]/page.tsx`).
- Before changing stock or fulfillment, inspect RPC-backed query files for `recoltari`, `vanzari`, `comenzi`, and `miscari-stoc`.
- Before changing stock reporting or audit recommendations, inspect `src/app/(dashboard)/rapoarte/*`, `src/lib/calculations/stock-audit.ts`, and `src/lib/supabase/queries/miscari-stoc.ts` together.
- Stock-audit thresholds are centralized in `src/lib/calculations/stock-audit-thresholds.ts`; keep UI labels and audit rules aligned with these constants.
- Multi-granular stock reporting now also uses `src/lib/calculations/stock-reporting.ts`. Preserve the rule that reports must never infer a finer grain (soi/locație) than the source data actually provides.
- For cheltuieli/investiții, keep the simplified universal taxonomy:
  - OPEX: `Îngrășăminte`, `Tratamente fitosanitare`, `Ambalaje`, `Forță de muncă`, `Combustibil / energie`, `Consumabile`, `Transport`, `Reparații / întreținere`, `Servicii`, `Altele`
  - CAPEX: `Material săditor`, `Irigații`, `Sisteme de susținere`, `Construcții`, `Echipamente / utilaje`, `Depozitare`, `Infrastructură`, `Solarii / sere`, `Îmbunătățiri teren`, `Altele`
- Before changing demo flows, inspect `src/lib/demo/*` and related API routes.
- Before changing settings/GDPR/admin behavior, inspect the associated API routes for same-origin, service-role, and protected-account logic.
- Before changing analytics, inspect `src/lib/analytics/track.ts`, `src/lib/analytics/trackEvent.ts`, `src/components/app/PageViewTracker.tsx`, `src/components/admin/AnalyticsDashboard.tsx`, and the `analytics_events` / `tenant_metrics_daily` migrations together.

## Incremental Context Rule

When future prompts modify architecture, domain logic, repository structure, or critical flows, update:

- `AGENTS.md`
- `docs/PROJECT_CONTEXT.md`
- `docs/CODE_STRUCTURE.md`
- `docs/DOMAIN_RULES.md`
- `docs/KNOWN_RISKS.md`
