import { describe, expect, it } from 'vitest'

import { sanitizeForLog, toSafeErrorContext } from '@/lib/logging/redaction'

describe('logging redaction helper', () => {
  it('redactează câmpuri sensibile, email și telefon', () => {
    const sanitized = sanitizeForLog({
      access_token: 'secret-token',
      refresh_token: 'refresh-token',
      email: 'ion@example.com',
      telefon: '+40 722 123 456',
      nested: {
        authorization: 'Bearer abc.def.ghi',
      },
    }) as Record<string, unknown>

    expect(sanitized.access_token).toBe('[REDACTED]')
    expect(sanitized.refresh_token).toBe('[REDACTED]')
    expect(sanitized.email).toBe('[REDACTED_EMAIL]')
    expect(sanitized.telefon).toBe('[REDACTED_PHONE]')
    expect((sanitized.nested as Record<string, unknown>).authorization).toBe('[REDACTED]')
  })

  it('redactează text liber pe câmpuri sensibile la opțiunea explicită', () => {
    const sanitized = sanitizeForLog(
      {
        message: 'Salut, numărul meu este 0722123456 și email ion@example.com',
        prompt: 'token=123',
      },
      { redactTextFields: true },
    ) as Record<string, unknown>

    expect(String(sanitized.message)).toMatch(/^\[REDACTED_TEXT len=\d+\]$/)
    expect(String(sanitized.prompt)).toMatch(/^\[REDACTED_TEXT len=\d+\]$/)
  })

  it('trunchiază payload-uri mari și ascunde pattern-uri sensibile în stringuri', () => {
    const large = `Bearer very-secret-token ${'x'.repeat(400)} ion@example.com`
    const sanitized = sanitizeForLog(large) as string

    expect(sanitized).toContain('[REDACTED_TOKEN]')
    expect(sanitized).not.toContain('ion@example.com')
    expect(sanitized.length).toBeLessThan(320)
    expect(sanitized).toContain('[TRUNCATED')
  })

  it('normalizează error context fără leak de token/email', () => {
    const error = new Error('Google failed for ion@example.com refresh_token=abc123')
    const safe = toSafeErrorContext(error)

    expect(safe.name).toBe('Error')
    expect(safe.message).not.toContain('ion@example.com')
    expect(safe.message).not.toContain('abc123')
    expect(safe.message).toContain('[REDACTED_EMAIL]')
    expect(safe.message).toContain('[REDACTED]')
  })
})
