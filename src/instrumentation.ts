/**
 * Instrumentation Next.js (un singur fișier în `src/`). Încarcă Sentry pentru runtime Node și Edge.
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 */
import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config')
  }
}

export const onRequestError = Sentry.captureRequestError
