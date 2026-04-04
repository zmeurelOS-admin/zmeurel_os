/**
 * Captură manuală + context tenant pe scope-uri Sentry.
 * User id/email pe client: `useSentryUser` (MonitoringInit). În căile care folosesc doar acești helperi fără
 * parametri `userId`/`tenantId`, contextul poate fi incomplet — pasați mereu tenant când îl cunoașteți.
 */
import * as Sentry from '@sentry/nextjs'

type SentryErrorContext = {
  route?: string
  component?: string
  tenantId?: string | null
  userId?: string | null
  tags?: Record<string, string | number | boolean | null | undefined>
  extra?: Record<string, unknown>
}

function applyScopeContext(scope: Sentry.Scope, context: SentryErrorContext) {
  if (context.route) {
    scope.setTag('api_route', context.route)
  }

  if (context.component) {
    scope.setTag('react_component', context.component)
  }

  if (context.tenantId) {
    scope.setTag('tenant_id', context.tenantId)
  }

  if (context.userId) {
    scope.setUser({ id: context.userId })
  }

  if (context.tags) {
    for (const [key, value] of Object.entries(context.tags)) {
      if (value === undefined || value === null) continue
      scope.setTag(key, String(value))
    }
  }

  if (context.extra) {
    for (const [key, value] of Object.entries(context.extra)) {
      scope.setExtra(key, value)
    }
  }
}

export function captureApiError(error: unknown, context: SentryErrorContext = {}) {
  Sentry.withScope((scope) => {
    scope.setTag('surface', 'api')
    applyScopeContext(scope, context)
    Sentry.captureException(error)
  })
}

export function captureReactError(error: unknown, context: SentryErrorContext = {}) {
  Sentry.withScope((scope) => {
    scope.setTag('surface', 'react')
    applyScopeContext(scope, context)
    Sentry.captureException(error)
  })
}

export function setSentryTenantTag(tenantId: string | null | undefined) {
  Sentry.setContext('tenant', tenantId ? { id: tenantId } : null)
}
