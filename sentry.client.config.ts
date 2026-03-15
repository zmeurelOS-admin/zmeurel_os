import * as Sentry from '@sentry/nextjs'

import { getServerSentryOptions } from './src/lib/monitoring/sentry-options'

Sentry.init({
  ...getServerSentryOptions(),
  integrations: [Sentry.replayIntegration()],
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
})
