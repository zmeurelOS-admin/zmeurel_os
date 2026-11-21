# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run build        # next build --webpack (runs check-env.js first)
npm run check        # lint + typecheck + build (full CI gate)
npm run check:kit    # regulile kitului de componente (tokeni canonici, text ≥ 13 px, straturi)
npm run test:critical:unit  # testele unitare (vitest, `vitest.critical.config.ts`; fișierele noi de test se adaugă în `include`)
npm run test:e2e     # Playwright e2e tests (`e2e/admin-access.spec.ts`: acces admin; dacă DB-ul blochează `is_superadmin` via service role, setează E2E_SUPERADMIN_EMAIL/PASSWORD în `.env.local`)
```

CI runs `lint` + `typecheck` on every PR. Always run both before committing. Testele unitare sunt cu vitest (`npm run test:critical:unit`, lista de fișiere în `include` din `vitest.critical.config.ts`); e2e cu Playwright (`npm run test:e2e`).

## Architecture Overview

**Zmeurel OS** is a multi-tenant agricultural SaaS (berry farms, greenhouses). The stack is Next.js 16 App Router, React 19, TypeScript, Supabase (PostgreSQL + Auth), TailwindCSS 4, shadcn/ui, TanStack Query v5, Framer Motion, Sentry, `@ai-sdk/google`, Zustand 5, `next-themes`, and `driver.js`.

### Route Groups

- `src/app/(auth)/` — login, reset-password, update-password (public)
- `src/app/(dashboard)/` — all protected pages; layout in `layout.tsx`
- `src/app/(onboarding)/start/` — demo + sign-up entry point
- `src/app/api/` — API routes (auth, admin, cron, demo, farm, gdpr)
- `src/app/admin/` — superadmin pages; protected by `src/app/(dashboard)/admin/layout.tsx`

### Auth & Middleware

`src/proxy.ts` intercepts every request (Next.js 16: use this file only; do not add `middleware.ts` alongside it):
1. Validates Supabase session cookie
2. Resolves `tenant_id` from `profiles` table
3. Injects `x-zmeurel-user-id`, `x-zmeurel-user-email`, `x-zmeurel-tenant-id` request headers
4. Redirects unauthenticated users to `/login`, users without a tenant to `/start`

Demo users exit to real signup via native `POST /api/auth/leave-demo` (form from banner or `/settings`), which signs out on the server and returns `303` to `/start`. Delogare generală pe server: `POST /api/auth/leave-demo` (demo) și `POST /api/auth/sign-out` (redirect `303`, implicit `/`, opțional `?next=/login`). UI folosește formulare POST, nu doar `signOut()` în client.

The dashboard layout (`src/app/(dashboard)/layout.tsx`) reads these headers to avoid a second DB call for user identity.

### Multi-tenancy

Every data row belongs to a tenant. The tenant is resolved from `profiles.tenant_id` (the current user's profile row). Two helpers are critical:

- `getTenantId(supabase)` — throws if not found; use in mutations
- `getTenantIdOrNull(supabase)` — returns null silently; **always use this in page server components** to avoid throwing into the error boundary

All query functions in `src/lib/supabase/queries/` call `getTenantId(supabase)` internally and accept the singleton browser client via `getSupabase()`.

### Supabase Clients

- **Browser (singleton)**: `getSupabase()` from `src/lib/supabase/client.ts`. Use in client components and query functions.
- **Server (per-request)**: `createClient()` from `src/lib/supabase/server.ts`. Use in server components and API routes.
- **Service role (admin)**: `getSupabaseAdmin()` from `src/lib/supabase/admin.ts`. Use only in admin server components/API routes where RLS must be bypassed.

### Data Fetching Pattern

Client pages follow a two-file pattern:
- `page.tsx` — thin server component that just renders the client component
- `*PageClient.tsx` — `'use client'` component with all React Query hooks and mutations

„Activități agricole” s-a redenumit **Lucrări**: `src/app/(dashboard)/lucrari/` (tabelul rămâne `activitati_agricole`, cheia modulului pentru operatori rămâne `activitati`). `/activitati-agricole` e doar o redirecționare la `/lucrari`, cu parametrii păstrați (precompletările din chatul AI). Tratamentele vechi din acel tabel se văd în Tratamente, „importate”; în Lucrări apar doar lucrările (`src/lib/lucrari/tipuri.ts` mapează tipurile vechi pe cele 8 noi, doar la afișare). Fișa parcelei e `/parcele/[id]`; `/parcele?selected=<id>` duce acolo.

Drepturile operatorilor (`src/lib/farm-members/access.ts`): Tratamentele au modulul lor, `tratamente` (Nu / Citește / Scrie, ruta `/tratamente`), separat de Lucrări (`activitati`). Drepturile salvate se citesc **doar** prin `resolveFarmMemberAccess`: un rând vechi cu `activitati` și fără `tratamente` primește `tratamente: read` (fără update în `farm_members`); „Nu” explicit se scrie cu `toStoredFarmMemberAccess` ca `{ module: 'tratamente', level: 'none' }`, ignorat de baza de date. Echipa e `/settings/echipa` (logica în `src/lib/echipa`); „Documente legale” sunt **Actele fermei**, `/settings/ferma/acte` (`/settings/documente-legale` redirecționează); ce lipsește vine dintr-o singură funcție, `stareActe` (`src/lib/acte/stare.ts`), folosită de ecran, banner și Setări.

TanStack Query defaults (set in `src/app/providers.tsx`):
```ts
staleTime: 60_000, gcTime: 10 * 60_000,
refetchOnWindowFocus: false, refetchOnReconnect: false, refetchOnMount: false, retry: 1
```

All query keys are defined in `src/lib/query-keys.ts`.

### Idempotency (fără coadă offline)

Nu există coadă offline: o salvare fără internet pică, iar formularul păstrează ce s-a scris și cheia, ca „Salvează” apăsat din nou să nu dubleze. Formularele de creare trimit un `client_sync_id` (UUID; `form.clientSyncId` din `useStepForm`, altfel `generateClientId()` din `src/lib/offline/generateClientId.ts`), același cât e deschis formularul și la reîncercare. Serverul deduplică pe el; `23505` pe indexul cheii înseamnă că rândul există deja și se tratează ca reușită (se recitește rândul).

- `recoltari`, `vanzari`, `cheltuieli_diverse`, `activitati_agricole`: `client_sync_id uuid not null default gen_random_uuid()` + index unic pe `(client_sync_id)`. Recoltările trec prin RPC-ul `create_recoltare_idempotent`.
- `comenzi`, `clienti`, `culegatori`, `investitii` (migrarea `20261121140000`): `client_sync_id uuid null` + index unic parțial pe `(tenant_id, client_sync_id)`. Helper-ele din `src/lib/supabase/idempotency.ts` (`cheieDeTrimis`, `findByClientSyncId`, `isClientSyncConflict`); cheia pleacă doar când coloana există (`schema-features`, grupul `cheiIdempotenta`).
- Plățile parțiale ale unei vânzări: RPC `adauga_plata_vanzare` cu cheia plății (`vanzari.plati_aplicate`), migrarea `20261121120000`.

### UI Layout

- Desktop: sidebar (`src/components/layout/Sidebar.tsx`) + scrollable main area
- Mobile: full-width content + bottom tab bar (`src/components/app/BottomTabBar.tsx`). E2E care deschide meniul „Mai mult”: după `goto` folosește `waitUntil: 'load'` (sau echivalent) ca să nu se facă click înainte de hidratarea React pe tab bar.
- Pages wrap content in `<AppShell header={<PageHeader ... />}>` from `src/components/app/`
- KPI cards use `<KpiCard>` from `src/components/app/KpiCard.tsx`
- shadcn/ui components live in `src/components/ui/`; no `Alert` component exists, only `alert-dialog`
- Design tokens: vezi `docs/redesign/tokens.md` (set canonic pe roluri în `src/styles/theme.css`; clase `bg-surface`, `text-fg`, `border-border`, `shadow-1`, `rounded-card`, `h-touch`; scara de straturi `z-bar` / `z-nav` / `z-fab` / `z-overlay` / `z-modal` / `z-popover` / `z-toast`). Numele vechi (`--agri-*`, `--text-primary`, `--surface-card`, `--status-*`, `--soft-*`) sunt aliasuri pentru modulele nerefăcute; nu le folosi în cod nou.

### Global State / Contexts

- `DashboardAuthContext` — provides `{ userId, email, isSuperAdmin }` from server; access via `useDashboardAuth()`
- `AddActionContext` — registers the page-level "add" action for the floating action button; access via `useAddAction()`
- Both are provided by `<Providers>` in `src/app/providers.tsx`

### Admin Section

`src/app/(dashboard)/admin/layout.tsx` enforces `isSuperAdmin` before rendering any admin page. The `isSuperAdmin()` helper queries `profiles.is_superadmin`. Admin pages use `getSupabaseAdmin()` for analytics queries and `createClient()` for tenant_metrics_daily.

### Analytics

Fire-and-forget tracking — never `await` these calls in business logic:

- `track(eventName, eventData?)` from `src/lib/analytics/track.ts` — uses `createClient()`
- `trackEvent({ eventName, moduleName?, status?, metadata? })` from `src/lib/analytics/trackEvent.ts` — uses `getSupabase()`; also supports legacy `trackEvent(eventType, module, metadata?)` string overloads
- `useTrackModuleView(moduleName)` from `src/lib/analytics/useTrackModuleView.ts` — hook that fires `view_module` once on mount

Events are stored in `public.analytics_events`. Key columns: `event_name`, `module`, `status` (`success|failed|abandoned|started`), `session_id`, `metadata`.

### Cron Jobs (Vercel, `vercel.json`)

Toate orele sunt UTC (România = UTC+2 iarna, UTC+3 vara):

- `06:00 zilnic` — sincronizarea contactelor Google (`/api/cron/sync-google-contacts`)
- `03:00 zilnic` — agregarea metricilor pe fermă (`/api/cron/admin-metrics-daily`, RPC `refresh_tenant_metrics_daily`)
- `04:00 luni` — rezumatul săptămânal pentru fermieri (`/api/cron/farmer-weekly-summary`)
- `04:30 luni` — verificarea documentelor legale (`/api/cron/farmer-legal-docs-check`)
- `05:00 zilnic` — mementourile de livrare pentru butași (`/api/cron/butasi-delivery-reminders`)
- `05:00 zilnic` — notificările de dimineață: ger, comenzi de mâine, bani de încasat (`/api/cron/notificari-dimineata`)
- `17:00 zilnic` — notificările de seară (`/api/cron/notificari-seara`)
- `04:00 zilnic` — Curățarea demo-urilor (`/api/cron/demo-tenant-cleanup`; regula în `src/lib/tenant/demo-cleanup.ts`, citirea și ștergerea în `demo-cleanup-server.ts`):
  - o fermă e demo **doar** dacă emailul proprietarului din `auth.users` (fără majuscule și spații) se termină în `@demo.zmeurel.local` și `tenants.created_at` e mai vechi de 24 h. `is_demo` / `expires_at` nu decid nimic. `@example.test` nu se șterge de aici;
  - nu intră niciodată: ferme fără proprietar sau cu proprietar fără email, superadmini, `DEMO_CLEANUP_PROTECTED_OWNER_USER_IDS`, ferme de asociație (`is_association_approved` sau proprietar în `association_members`), proprietari cu mai multe ferme;
  - `DEMO_CLEANUP_MODE`: lipsă sau orice altă valoare decât `sterge` = **probă** (doar numără: JSON cu `mod: "proba"`, câte ferme, câte fișiere din `bonuri`, primele 20 de emailuri demo, semnele de fermă reală; se vede și în jurnalele Vercel, `[demo-tenant-cleanup] proba`). `sterge` = șterge efectiv. Se trece pe `sterge` doar după ce proba din jurnale a fost citită;
  - în `sterge`: maximum 50 de ferme pe rulare (cele mai vechi), reverificare înainte de fiecare ștergere, oprire cu eroare pentru toată rularea la orice semn de fermă reală (`semneFermaReala`); o fermă care dă eroare la ștergere nu le oprește pe celelalte (raportată prin `captureApiError`);
  - ordinea pentru o fermă: fișierele din `bonuri/{tenant_id}/` → tabelele doar-demo (`DEMO_ONLY_DELETE_ORDER`: lanțul de tratamente cu chei `RESTRICT`, `ai_usage_log`) → `deleteTenantScopedData` → rândul din `tenants` (restul pleacă în cascadă) → utilizatorul din `auth` (în cascadă: `profiles`, `notifications`, `push_subscriptions`, `notificari_preferinte`).

### Database Migrations

Migrations live in `supabase/migrations/` as `.sql` files. Run them manually in the Supabase dashboard SQL editor or via the Supabase CLI. The generated TypeScript types are in `src/types/supabase.ts`.

Orice funcție nouă `SECURITY DEFINER` din `public` se încheie în aceeași migrare cu `revoke execute on function ... from public, anon;` și `grant execute on function ... to authenticated, service_role;` (sau doar `service_role`, dacă nu e RPC al aplicației). Funcțiile noi primesc implicit `EXECUTE` pentru `PUBLIC`.

### Key Conventions

- All user-facing text is in Romanian
- Page server components must use `getTenantIdOrNull` (not `getTenantId`) to avoid throwing
- After mutations that affect cached data, call the appropriate `queryClient.invalidateQueries({ queryKey: queryKeys.X })`
- Conflict errors (status 409 / code `23505`) from Supabase are treated as success (idempotent creates)
- Form dialogs track `open_create_form` → `create_success`/`create_failed`/`form_abandoned` lifecycle using a `submittedRef` + `hasOpenedRef` pattern

## Kitul de componente (`src/components/kit/`)

Baza modulelor refăcute (Recoltări, apoi Comenzi + Livrări). Totul se importă din `@/components/kit`. Pagina vie, zi și noapte: `/admin/kit` (doar superadmin). Referință: `docs/redesign/tokens.md`.

**Ce există**

- Butonul rămâne unul singur, `ui/button.tsx`. Pentru kit: variantele `primary` / `neutral` / `danger` / `quiet`, mărimile `touch` (48) / `touch-lg` (56) / `icon-touch`, prop-ul `loading`. Variantele și mărimile vechi sunt pentru modulele nerefăcute.
- Primitive: `Tile` + `TileGroup`, `Segments`, `FilterPills`, `StatTile`, `StatHero`, `StatusPill`, `EmptyState`, `BigInput` + `BigTextarea`, `ListRow`, `ToggleRow`, `CheckRow`, `Notice`, `ProgressBar`, `ActionCard`.
- Compuse: `BottomSheet`, `StepForm` + `useStepForm`, `CalendarSheet` + `CalendarPanel`, `NumberStepper`, `NumericKeypad`, `KgField` + `useKeypadFields`, `SummaryRow` + `SummaryList`, `SuccessScreen`.

**Reguli pentru kit și pentru modulele refăcute**

- Doar tokenii canonici din `tokens.md`: fără hex, fără `dark:`, fără `--agri-*` / `--text-primary` / `--surface-card` / `--status-*` / `--soft-*`, fără `text-[...]` sub 13 px și fără `text-xs`, fără z-index numeric (`z-[...]`, `z-40` și mai mari, `zIndex` în `style`); doar clasele de strat.
- Scara de text 26 / 22 / 19 / 17 / 15 / 13 (+ 64 cifra mare), din `kitText` (`kit/text.ts`). 13 e doar text ajutător, niciodată textul unui element apăsabil. Câmpurile au minimum 16 px (folosim 17).
- Ținte de atingere de cel puțin 48 px, acțiunea principală 56 px, prin `h-touch` / `h-touch-lg` (citesc `--touch-control-h*`: densitate, vizibilitate ridicată). Excepție: tastele `NumericKeypad` au 60 px, fix.
- Foile și ferestrele se deschid în portal, peste bara de jos (`z-modal`): `BottomSheet` și `StepForm`, nu `createPortal` și nu `ui/sheet` direct (`ui/sheet` singur nu ascunde butonul plutitor și nu ascultă „înapoi” pe Android).
- Text în română; ARIA corect: roluri `radio` / `checkbox` / `switch` / `tablist`, `aria-pressed` / `aria-checked`, etichete pe butoanele doar-iconiță.
- Fiecare componentă e exportată din `src/components/kit/index.ts`.

**Formulare pe pași**

- `useStepForm` ține navigarea, resetul la deschidere, ciclul de analytics (`open_create_form` → `create_success` / `create_failed` / `form_abandoned`) și cheia de idempotență. Modulul nu mai scrie `submittedRef` / `hasOpenedRef`.
- `form.clientSyncId` se trimite ca `client_sync_id` la creare. E aceeași cât e deschis formularul (și la reîncercarea după eroare) și alta la `form.restart()` și la următoarea deschidere. La o cheie nouă, modulul își golește câmpurile.
- După salvare: `form.markSuccess()`; la eroare: `form.markFailed()`. Cu `mode: 'edit'` sau `analytics: false` nu se trimite niciun eveniment.
- Tastatura din aplicație se pune în `dock` (zona fixă a carcasei), ca să rămână întreagă pe ecran. Câmpul de kg (`KgField`) pornește gol, fără valoare propusă.
- Un calendar într-un pas se pune cu `CalendarPanel`, în pagină; `CalendarSheet` e pentru paginile obișnuite.
- Nimic nu se deschide peste un `StepForm` (nici `BottomSheet`, nici alt dialog): două ferestre suprapuse se închid amândouă la „înapoi” pe Android. Alegerile dintr-un pas (dată, listă, notă) țin locul conținutului pasului și se închid cu `onBack`; o foaie se închide înainte să se deschidă formularul.
- Închiderea cu ceva nesalvat: `closeGuard` pe `StepForm` (X, Esc, „înapoi”). Întoarce `true` și modulul arată confirmarea în pas; închiderea hotărâtă de modul se face cu `onOpenChange(false)`.
- O valoare care există deja (editare, cantitate dictată) intră în `KgField` cu `fields.setValue`, nu ca propunere.
- Resetul câmpurilor la o cheie nouă (`form.clientSyncId`) poate rula de două ori pentru aceeași deschidere: trebuie să dea același rezultat de fiecare dată.
- Model de urmat: Recoltări (`src/app/(dashboard)/recoltari/`, `src/components/recoltari/`).

**Verificare automată**

`npm run check:kit` (`scripts/check-kit-rules.mjs`) pică la orice abatere de la regulile de mai sus în folderele din `KIT_RULE_DIRS` (`scripts/kit-rules.mjs`): kitul, `/admin/kit` și toate modulele refăcute (Recoltări, Comenzi, Livrări, Acasă pe telefon, Clienți, Culegători, Cheltuieli + Investiții, Vânzări, Mai mult, Notificări, Setări, Tratamente, Stocuri, Produse, Rapoarte, Parcele, Lucrări, Echipa, Actele fermei, acceptarea invitației), cu folderele lor din `src/app/(dashboard)`, `src/components` și `src/lib`. Fișierele vechi rămase într-un folder verificat stau în `KIT_RULE_PENDING_FILES`. Folderul fiecărui modul refăcut se adaugă pe listă când începe refacerea lui. Testele kitului sunt în `src/components/kit/__tests__/` și rulează cu `npm run test:critical:unit`.

## AI Chat Widget

- **Model**: `gemini-2.5-flash` (configurabil via `AI_GEMINI_MODEL` env var) prin `@ai-sdk/google`
- **Files**: `src/app/api/chat/route.ts`, `src/components/ai/AiBottomSheet.tsx`
- **New table**: `ai_conversations` — columns: `id uuid PK`, `tenant_id uuid`, `user_id uuid`, `mesaj_user text`, `raspuns_ai text`, `pathname text`, `created_at timestamptz`
- **Rate limit**: 20 msg/zi pentru utilizatori normali, 60 msg/zi pentru superadmin și contul de test `zmeurel.app@gmail.com`. Configurabil via `AI_CHAT_DAILY_LIMIT`. Contorizarea folosește `profiles.ai_messages_count` + `profiles.last_ai_usage_date` și se resetează zilnic în timezone `Europe/Bucharest`.
- **Profiles columns required**: `ai_messages_count integer DEFAULT 0`, `last_ai_usage_date date`
- **Max input**: last 4 messages kept; last user message truncated to 500 chars; system prompt ~300 tokens
- **Keyword detection**: active — queries `activitati_agricole`, `clienti`, `cheltuieli_diverse`, `recoltari`, `comenzi`, `miscari_stoc` only when message matches relevant keywords
- **Session memory**: last 3 exchanges loaded from `ai_conversations` table on each request
- **Proactive alerts**: on first message of session, checks parcele with no activity in last 7 days
- **Voice input**: Web Speech API `ro-RO` — zero new dependencies; shown only if browser supports it
- **Logo**: `/public/icons/icon.svg` rendered via `next/image`
- **Form prefill** (open_form intent): returns non-streaming JSON `{ action: 'open_form', form, message, prefill }` — agent does NOT INSERT data; routes user to `/cheltuieli`, `/recoltari`, or `/activitati-agricole` with URL params
- **Env vars AI**:
  - `GOOGLE_GENERATIVE_AI_API_KEY`
  - `AI_GEMINI_MODEL`
  - `AI_GEMINI_SIMPLE_MODEL` — model alternativ pentru mesaje scurte `<180` chars
  - `AI_CHAT_DAILY_LIMIT`
  - `AI_CHAT_MAX_OUTPUT_TOKENS` — default `220`
  - `AI_CHAT_USAGE_LOG` — `true/false`, default `false`
- **Relevant RPCs**:
  - `check_and_increment_ai_usage` — rate limiting atomic
  - `resolve_recoltare_stock_identity` — determinare produs din parcelă/cultură
- See `docs/ai-chat-widget.md` for full documentation

## Known Issues

Fixed in audit sprint:

- Structured extraction din AI chat nu mai sare peste fallback-ul deterministic când `generateObject` eșuează.
- Voice input oferă acum feedback clar la erori, timeout de 15 secunde și ascunde microfonul pe browsere fără suport.
- Date sensibile (`telefon`, `pret_negociat_lei_kg`) nu mai sunt trimise către model în canonical candidates.
- `ai_conversations` are cleanup automat pentru intrările mai vechi de 90 de zile prin cron.
- `activitati_extended` și `parcele_extended` au fost reîmprospătate pentru a include coloanele noi din schema curentă.
- Sistemul dual de contabilizare din `miscari_stoc` este documentat, iar ajustările manuale populează coerent atât `cantitate_kg`, cât și `cantitate_cal1` / `cantitate_cal2`.
