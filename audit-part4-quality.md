# Audit Part 4 - Quality (read-only)

Data audit: 2026-03-07

## 1) TypeScript check
Comandă rulată:
`npx tsc --noEmit 2>&1 | Out-File tsc-result.txt`

Rezultat:
- Fișierul `tsc-result.txt` există și este gol (0 linii), deci TypeScript nu a raportat erori la acest pas.

## 2) Există teste?
Da, există teste în proiect (excluzând `node_modules`):
- E2E Playwright:
  - `e2e/idempotency.spec.ts`
  - `e2e/nav-perf.spec.ts`
  - `e2e/offline.spec.ts`
  - `e2e/plan-gating.spec.ts`
  - `e2e/reports.spec.ts`
  - `e2e/security.spec.ts`
  - `e2e/smoke.spec.ts`
  - `e2e/stocuri.spec.ts`
- Unit:
  - `src/__tests__/profit.test.ts`

Observații:
- Config Playwright prezent: `playwright.config.ts`.
- În `package.json` NU există script `test`; verificările standard (`check`) rulează doar `lint`, `typecheck`, `build`.

## 3) Există manifest.json sau next-pwa config?
Da.

Manifest:
- Manifest dinamic Next: `src/app/manifest.ts` (expus ca `manifest.webmanifest`).
- `src/app/layout.tsx` referă `manifest: '/manifest.webmanifest'`.

PWA:
- Config `next-pwa` în `next.config.js` (`withPWA(...)`).
- Dependență prezentă: `next-pwa` în `package.json`.
- Service worker prezent în `public/sw.js` și `public/workbox-caec65b4.js` (+ `.map`).
- Înregistrare SW în client: `src/components/app/ServiceWorkerRegister.tsx`.

## 4) Există Sentry config? Unde?
Da.

Fișiere relevante:
- `next.config.js` (wrap cu `withSentryConfig`)
- `sentry.server.config.ts` (init server)
- `src/instrumentation.ts` (register + `onRequestError`)
- `src/instrumentation-client.ts` (init client + `onRouterTransitionStart`)
- `src/components/app/MonitoringInit.tsx`
- `src/lib/monitoring/useSentryUser.ts` (setează user în Sentry)

## 5) package.json - dependențe principale
Runtime (principale):
- Framework/UI: `next@16.1.6`, `react@19.2.3`, `react-dom@19.2.3`
- Data/Auth: `@supabase/supabase-js`, `@supabase/ssr`, `@supabase/auth-helpers-nextjs`
- Monitoring: `@sentry/nextjs`
- State/fetch/forms: `@tanstack/react-query`, `react-hook-form`, `zod`, `zustand`
- UI libs: `@radix-ui/*`, `lucide-react`, `sonner`, `class-variance-authority`, `clsx`
- PWA: `next-pwa`

Dev (principale):
- `typescript`, `eslint`, `eslint-config-next`
- `@playwright/test`
- `tailwindcss`, `@tailwindcss/postcss`, `tw-animate-css`, `shadcn`

## 6) TOP 10 probleme găsite (ordonate după gravitate)
1. `npm run lint` eșuează cu multe probleme: **57 errors + 109 warnings** (`lint-result.txt`), deci quality gate-ul de lint este roșu.
2. Mai multe erori `react-hooks/set-state-in-effect` (ex: `src/app/(auth)/login/page.tsx`, `src/app/(dashboard)/cheltuieli/CheltuialaPageClient.tsx`, `src/app/(dashboard)/comenzi/ComenziPageClient.tsx`) pot induce rerender-uri în cascadă și comportament instabil.
3. Foarte multe `@typescript-eslint/no-explicit-any` în zone critice de business (ex. `src/lib/supabase/queries/comenzi.ts`, `src/lib/supabase/queries/stoc.ts`, `src/lib/offline/syncEngine.ts`) reduc siguranța tipurilor exact în fluxuri sensibile.
4. Eroare `@next/next/no-assign-module-variable` în `src/lib/analytics/trackEvent.ts` (potențial bug de runtime/SSR pentru modulul respectiv).
5. Fișiere generate PWA (`public/sw.js`, `public/workbox-*.js`) sunt lintuite și produc masiv warnings; acest zgomot ascunde probleme reale în codul sursă.
6. `public/sw.js.map` și `public/workbox-*.js.map` sunt prezente și includ căi locale de build (ex. `C:/Users/Andrei/...`) -> leak de metadata internă.
7. Nu există pipeline CI (`.github/workflows` lipsește), deci nu există validare automată consistentă la push/PR.
8. Nu există script `test` în `package.json`; testele nu sunt integrate în comanda standard `check`.
9. Acoperire de unit tests foarte redusă în repo (practic un singur test unit explicit: `src/__tests__/profit.test.ts`), risc de regresii logice.
10. Erori de stil/import CommonJS (`@typescript-eslint/no-require-imports`) în `next.config.js` și `scripts/check-env.js`; arată inconsistență de standard și blochează lint-ul.

---

Artefacte generate în audit:
- `tsc-result.txt`
- `lint-result.txt`
