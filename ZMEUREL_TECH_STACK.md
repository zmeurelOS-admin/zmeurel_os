# Zmeurel — Tech Stack & Arhitectură (rezumat)

## Stack principal (framework + runtime)
- **Next.js** (`16.1.6`)
  - **App Router** (structură în `src/app/`)
  - **Route Handlers API** (ex: `src/app/api/...`)
  - **Server Components + Client Components** (pattern cu `Providers` în `src/app/providers.tsx`)
- **React** (`19.2.3`) + **TypeScript** (`^5`)

## UI / Design System
- **Tailwind CSS v4** (`tailwindcss`, `@tailwindcss/postcss`)
- **shadcn/ui tooling** (`shadcn`) + utilitare styling
  - `class-variance-authority`, `clsx`, `tailwind-merge`, `tailwindcss-animate`, `tw-animate-css`
- **Radix UI / primitives**
  - `@radix-ui/react-dialog`, `@radix-ui/react-tabs`, `@radix-ui/react-label`, `@radix-ui/react-slot`
- **Iconuri**
  - `lucide-react`
- **Animații / interacțiuni**
  - `framer-motion`
- **Notificări**
  - `sonner`

## Data layer / State / Forms
- **Supabase**
  - Client SSR: `@supabase/ssr`
  - SDK: `@supabase/supabase-js`
  - Tipuri DB: `src/types/supabase` (folosit în `src/proxy.ts`, `src/lib/supabase/*`)
- **TanStack Query v5** (`@tanstack/react-query`)
  - Configurat global în `src/app/providers.tsx`
  - Chei centralizate în `src/lib/query-keys.ts`
- **TanStack Table** (`@tanstack/react-table`)
- **State management local**
  - `zustand`
- **Forme + validare**
  - `react-hook-form` + `@hookform/resolvers`
  - `zod`

## AI / Chat
- **Vercel AI SDK**
  - `ai`
  - Provider Google: `@ai-sdk/google`
- Implementare API
  - Endpoint: `src/app/api/chat/route.ts` (POST delegat către handler)
  - Logică principală: `src/app/api/chat/*` (orchestrare, contracte, extractori, detectoare)

## Observabilitate, monitorizare, analytics
- **Sentry** (`@sentry/nextjs`)
  - Hook-uri de inițializare în `src/app/layout.tsx` prin `MonitoringInit`
  - Fișiere de instrumentare: `src/instrumentation.ts`, `src/instrumentation-client.ts`

## PWA / offline
- **next-pwa** (`next-pwa`)
- Config PWA/manifest
  - `src/app/manifest.ts`
  - `src/app/layout.tsx` include manifest și meta pentru experiență mobile/PWA

## Alte librării notabile
- **Import/Export Excel**: `xlsx`
- **Product tour / onboarding UI**: `driver.js`
- **dotenv**: `dotenv` (folosit în tooling / scripturi)

## Testare & Calitate
- **ESLint** (`eslint`, `eslint-config-next`)
- **Playwright** (`@playwright/test`)
  - Suite dedicată AI chat (scripturi: `test:ai-chat`, `test:ai-chat:integration`)
- Scripturi utile (din `package.json`)
  - `lint`, `typecheck`, `build`, `check`
  - `check:ai-chat` (lint + typecheck + test pe zona chat)

---

# Arhitectură (cum e organizat proiectul)

## Structura de top în `src/`
- **`src/app/`**
  - Rute Next.js App Router (inclusiv grupuri precum `(dashboard)`, `(auth)`, `(onboarding)`)
  - API routes în `src/app/api/` (ex: `api/chat`)
  - Layout-uri globale și per-aria aplicației (`layout.tsx`, `(dashboard)/layout.tsx`)
- **`src/components/`**
  - Componente UI și componente de aplicație (sidebar, tab bar, AI panel/FAB, init de monitoring, etc.)
- **`src/lib/`**
  - Logică de business, query helpers, utilitare, integrare Supabase, analytics, offline, tenant, financiar
- **`src/proxy.ts`**
  - Gardă de request (auth + tenant headers) — o piesă centrală pentru multi-tenant
- **`src/types/`**
  - Tipuri (în special tipurile Supabase `Database`)

## Fluxul de autentificare + multi-tenant (observat)
- **Request guard / proxy**: `src/proxy.ts`
  - Creează un Supabase server client (`@supabase/ssr`) și încearcă `supabase.auth.getUser()`
  - Pentru rute protejate, redirecționează la login când nu există user
  - Rezolvă `tenantId` pentru user și injectează headere:
    - `x-zmeurel-user-id`
    - `x-zmeurel-user-email`
    - `x-zmeurel-tenant-id`
- **Dashboard layout**: `src/app/(dashboard)/layout.tsx`
  - Preferă headerele injectate de proxy când sunt prezente
  - Construiește `initialAuth` și îl pasează în `Providers`

## Providers & data fetching
- **`src/app/providers.tsx`** (Client Component)
  - Inițializează `QueryClientProvider` (TanStack Query)
  - Pune la dispoziție contextul de auth și alte contexte (ex: UI density, trackers)
- **Chei centralizate**: `src/lib/query-keys.ts`
  - Standardizează invalidarea și caching-ul între ecrane

## Supabase client separation (browser vs server)
- **Browser client**: `src/lib/supabase/client.ts`
  - Singleton `createBrowserClient` cu PKCE (persist session, refresh token)
- **Server client**: `src/lib/supabase/server.ts`
  - `createServerClient` legat de `next/headers` cookies

## API routes (exemplu: AI chat)
- **`src/app/api/chat/route.ts`** expune `POST` delegat către `createChatPostHandler()`
- Logica detaliată este ținută în `src/app/api/chat/` (separare clară între wrapper și orchestrare)

---

## Observații de design (din ce se vede în cod)
- **Separare clară pe arii**:
  - Routing/UI în `app/` și `components/`
  - Business/data access în `lib/`
- **Multi-tenant by design**:
  - Guard central (proxy) + headere de context
- **Client-side caching robust**:
  - TanStack Query configurat global; chei de query centralizate
