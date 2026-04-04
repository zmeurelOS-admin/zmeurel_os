/**
 * Read-only snapshot of Sentry wiring for admin «Tech Health» (no Sentry API calls, no secrets exposed).
 */
import packageJson from '../../../package.json'

import {
  resolveSentryReleaseFromEnv,
  SENTRY_INSTRUMENTATION_CLIENT_FILE,
  SENTRY_INSTRUMENTATION_HOOK_FILE,
  SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE,
  SENTRY_REPLAY_SESSION_SAMPLE_RATE,
  SENTRY_TRACES_SAMPLE_RATE,
} from '@/lib/monitoring/sentry-runtime'

export type SentryHealthStatus = 'active' | 'partial' | 'inactive' | 'uncertain'

export type SentryTechHealth = {
  sdkPackage: string
  sdkVersionRange: string
  dsnConfigured: boolean
  /** `sentry-options`: raportare dezactivată explicit în development. */
  reportingEnabledThisNodeEnv: boolean
  environment: string
  tracesSampleRate: number
  replaySessionSampleRate: number
  replayOnErrorSampleRate: number
  /** Profiling nu e setat în `getServerSentryOptions` / client init. */
  profilingExplicitlyConfigured: boolean
  nextjsWebpackIntegration: boolean
  reactComponentAnnotation: boolean
  /** Fișiere unice în repo pentru hooks (Next + ordin @sentry/nextjs). */
  canonicalHookPaths: { serverEdge: string; client: string }
  runtimesInstrumented: {
    nodeServer: boolean
    edge: boolean
    client: boolean
  }
  userContextClient: {
    status: SentryHealthStatus
    detail: string
  }
  /** Release citit în runtime din env prin aceeași logică ca `getServerSentryOptions`. */
  releaseResolvedFromEnv: string | null
  releaseNote: string
  sourceMapsNote: string
  optionalDashboardUrl: string | null
  caveats: string[]
}

export function getSentryTechHealth(): SentryTechHealth {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
  const dsnConfigured = Boolean(dsn && String(dsn).trim().length > 0)
  const reportingEnabledThisNodeEnv =
    dsnConfigured && process.env.NODE_ENV !== 'development'

  const deps = packageJson.dependencies as Record<string, string> | undefined
  const sdkRange = deps?.['@sentry/nextjs'] ?? '—'

  const releaseResolved = resolveSentryReleaseFromEnv() ?? null

  const optionalDashboardUrl =
    typeof process.env.NEXT_PUBLIC_SENTRY_DASHBOARD_URL === 'string' &&
    process.env.NEXT_PUBLIC_SENTRY_DASHBOARD_URL.trim().length > 0
      ? process.env.NEXT_PUBLIC_SENTRY_DASHBOARD_URL.trim()
      : null

  const caveats: string[] = [
    'Nu interogăm API-ul Sentry: fără rate-uri de erori live, fără latency din Sentry.',
    'Release în browser: dacă lipsește VERCEL_GIT_COMMIT_SHA la runtime client, setează SENTRY_RELEASE sau NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ca să coincidă cu serverul.',
  ]

  if (!dsnConfigured) {
    caveats.push('Fără `NEXT_PUBLIC_SENTRY_DSN`, SDK-ul rămâne dezactivat (`enabled: false`).')
  }

  return {
    sdkPackage: '@sentry/nextjs',
    sdkVersionRange: sdkRange,
    dsnConfigured,
    reportingEnabledThisNodeEnv,
    environment:
      process.env.NEXT_PUBLIC_VERCEL_ENV ||
      process.env.VERCEL_ENV ||
      process.env.NODE_ENV ||
      'unknown',
    tracesSampleRate: SENTRY_TRACES_SAMPLE_RATE,
    replaySessionSampleRate: SENTRY_REPLAY_SESSION_SAMPLE_RATE,
    replayOnErrorSampleRate: SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE,
    profilingExplicitlyConfigured: false,
    nextjsWebpackIntegration: true,
    reactComponentAnnotation: true,
    canonicalHookPaths: {
      serverEdge: SENTRY_INSTRUMENTATION_HOOK_FILE,
      client: SENTRY_INSTRUMENTATION_CLIENT_FILE,
    },
    runtimesInstrumented: {
      nodeServer: true,
      edge: true,
      client: true,
    },
    userContextClient: {
      status: dsnConfigured ? 'partial' : 'inactive',
      detail: dsnConfigured
        ? 'Client: hook-ul useSentryUser setează id și email; tenant în setContext("tenant"). În API/React, tag-uri tenant_id / userId unde există captureApiError / captureReactError — nu e garantat pe toate căile.'
        : 'Fără DSN nu se trimite nimic către Sentry.',
    },
    releaseResolvedFromEnv: releaseResolved,
    releaseNote:
      'Aceeași rezolvare ca în sentry-options (SENTRY_RELEASE → VERCEL_GIT_COMMIT_SHA → NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA). Plugin-ul webpack @sentry/nextjs poate completa release la build — nu îl citim separat aici.',
    sourceMapsNote:
      'withSentryConfig în next.config.js + SENTRY_AUTH_TOKEN la build permit upload către Sentry CLI. Confirmarea că artefactele au ajuns în proiect cere log de build sau consola Sentry — nu e verificabil din această pagină.',
    optionalDashboardUrl,
    caveats,
  }
}
