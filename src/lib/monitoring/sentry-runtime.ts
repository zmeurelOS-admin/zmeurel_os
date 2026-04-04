/**
 * Valori comune Sentry folosite la init (server / edge / client) și în Tech Health.
 * Release: ordine explicită, fără valori inventate — undefined dacă lipsesc toate sursele.
 */
export const SENTRY_TRACES_SAMPLE_RATE = 0.2
export const SENTRY_REPLAY_SESSION_SAMPLE_RATE = 0.1
export const SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE = 1.0

/** Fișiere canonice pentru Next 16 + structură `src/` (verify în `node_modules/@sentry/nextjs` — ordinea de rezolvare). */
export const SENTRY_INSTRUMENTATION_HOOK_FILE = 'src/instrumentation.ts'
export const SENTRY_INSTRUMENTATION_CLIENT_FILE = 'src/instrumentation-client.ts'

/**
 * Release pentru Sentry.init — aceleași variabile ca în deploy-uri Vercel / override manual.
 * Pe client, la runtime în browser, VERCEL_GIT_COMMIT_SHA poate lipsi; folosește SENTRY_RELEASE sau
 * NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA în env dacă vrei același release peste tot.
 */
export function resolveSentryReleaseFromEnv(): string | undefined {
  const a = process.env.SENTRY_RELEASE?.trim()
  if (a) return a
  const b = process.env.VERCEL_GIT_COMMIT_SHA?.trim()
  if (b) return b
  const c = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.trim()
  if (c) return c
  return undefined
}
