import * as Sentry from '@sentry/nextjs'

import { getServerSentryOptions } from './src/lib/monitoring/sentry-options'

Sentry.init(getServerSentryOptions())
