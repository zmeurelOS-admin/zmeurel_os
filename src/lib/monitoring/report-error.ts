import { sanitizeForLog, toSafeErrorContext } from '@/lib/logging/redaction'

type ErrorContext = {
  route?: string
  component?: string
  tenantId?: string | null
  userId?: string | null
  tags?: Record<string, string | number | boolean | null | undefined>
  extra?: Record<string, unknown>
}

function normalizeContext(surface: 'api' | 'react', context: ErrorContext) {
  return sanitizeForLog(
    {
      surface,
      route: context.route ?? null,
      component: context.component ?? null,
      tenant_id: context.tenantId ?? null,
      user_id: context.userId ?? null,
      tags: context.tags ?? {},
      extra: context.extra ?? {},
    },
    { redactTextFields: true },
  )
}

function logCapturedError(surface: 'api' | 'react', error: unknown, context: ErrorContext) {
  const safeError = toSafeErrorContext(error)
  const safeContext = normalizeContext(surface, context)
  const prefix = surface === 'api' ? '[api-error]' : '[react-error]'

  console.error(prefix, {
    error: safeError,
    context: safeContext,
  })
}

export function captureApiError(error: unknown, context: ErrorContext = {}) {
  logCapturedError('api', error, context)
}

export function captureReactError(error: unknown, context: ErrorContext = {}) {
  logCapturedError('react', error, context)
}
