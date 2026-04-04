import * as Sentry from '@sentry/nextjs'

import { getServerSentryOptions } from '@/lib/monitoring/sentry-options'
import {
  SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE,
  SENTRY_REPLAY_SESSION_SAMPLE_RATE,
} from '@/lib/monitoring/sentry-runtime'

Sentry.init({
  ...getServerSentryOptions(),
  integrations: [Sentry.replayIntegration()],
  replaysSessionSampleRate: SENTRY_REPLAY_SESSION_SAMPLE_RATE,
  replaysOnErrorSampleRate: SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE,
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
