const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN || undefined
const sentryEnvironment =
  process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.VERCEL_ENV || process.env.NODE_ENV

export const sentryIgnoreErrors = [
  'ResizeObserver loop limit exceeded',
  'Script error',
  'NetworkError when attempting to fetch resource',
]

function getBaseSentryOptions() {
  return {
    dsn: sentryDsn,
    enabled: Boolean(sentryDsn) && process.env.NODE_ENV !== 'development',
    environment: sentryEnvironment,
    ignoreErrors: sentryIgnoreErrors,
    tracesSampleRate: 0.2,
  }
}

export function getServerSentryOptions() {
  return getBaseSentryOptions()
}
