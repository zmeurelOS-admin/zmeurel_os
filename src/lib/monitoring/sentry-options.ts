import { resolveSentryReleaseFromEnv, SENTRY_TRACES_SAMPLE_RATE } from '@/lib/monitoring/sentry-runtime'

const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN || undefined
const sentryEnvironment =
  process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.VERCEL_ENV || process.env.NODE_ENV

export const sentryIgnoreErrors = [
  'ResizeObserver loop limit exceeded',
  'Script error',
  'NetworkError when attempting to fetch resource',
]

function getBaseSentryOptions() {
  const release = resolveSentryReleaseFromEnv()
  return {
    dsn: sentryDsn,
    enabled: Boolean(sentryDsn) && process.env.NODE_ENV !== 'development',
    environment: sentryEnvironment,
    ignoreErrors: sentryIgnoreErrors,
    tracesSampleRate: SENTRY_TRACES_SAMPLE_RATE,
    ...(release ? { release } : {}),
  }
}

export function getServerSentryOptions() {
  return getBaseSentryOptions()
}
