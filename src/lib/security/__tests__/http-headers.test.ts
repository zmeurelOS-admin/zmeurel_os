import { describe, expect, it } from 'vitest'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildBaseSecurityHeaders, buildContentSecurityPolicy } = require('../http-headers.js')

function findHeader(
  headers: Array<{ key: string; value: string }>,
  key: string,
): { key: string; value: string } | undefined {
  return headers.find((header) => header.key.toLowerCase() === key.toLowerCase())
}

describe('security headers config', () => {
  it('emite CSP strictă pentru production', () => {
    const csp = buildContentSecurityPolicy({
      isDevelopment: false,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: 'https://ilybohhdeplwcrbpblqw.supabase.co',
        NEXT_PUBLIC_SENTRY_DSN: 'https://abc123@o999.ingest.sentry.io/123456',
      },
    })

    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("frame-ancestors 'self'")
    expect(csp).toContain('https://ilybohhdeplwcrbpblqw.supabase.co')
    expect(csp).toContain('wss://ilybohhdeplwcrbpblqw.supabase.co')
    expect(csp).toContain('https://o999.ingest.sentry.io')
    expect(csp).toContain('upgrade-insecure-requests')
    expect(csp).not.toContain("'unsafe-eval'")
  })

  it('permite compatibilitate dev pentru HMR', () => {
    const csp = buildContentSecurityPolicy({
      isDevelopment: true,
      env: {},
    })

    expect(csp).toContain("'unsafe-eval'")
    expect(csp).toContain('ws://localhost:*')
    expect(csp).toContain('http://localhost:*')
    expect(csp).not.toContain('upgrade-insecure-requests')
  })

  it('include headerele cheie și HSTS doar în production', () => {
    const prodHeaders = buildBaseSecurityHeaders({ isDevelopment: false, env: {} })
    const devHeaders = buildBaseSecurityHeaders({ isDevelopment: true, env: {} })

    expect(findHeader(prodHeaders, 'Content-Security-Policy')).toBeDefined()
    expect(findHeader(prodHeaders, 'Referrer-Policy')?.value).toBe(
      'strict-origin-when-cross-origin',
    )
    expect(findHeader(prodHeaders, 'X-Content-Type-Options')?.value).toBe('nosniff')
    expect(findHeader(prodHeaders, 'Permissions-Policy')?.value).toBe(
      'camera=(), microphone=(self), geolocation=()',
    )
    expect(findHeader(prodHeaders, 'Strict-Transport-Security')?.value).toBe(
      'max-age=63072000; includeSubDomains; preload',
    )
    expect(findHeader(devHeaders, 'Strict-Transport-Security')).toBeUndefined()
  })
})
