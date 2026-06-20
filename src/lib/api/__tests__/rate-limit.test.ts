import { beforeEach, describe, expect, it } from 'vitest'

import {
  __resetRateLimitForTests,
  consumeFixedWindowRateLimit,
} from '@/lib/api/rate-limit'

describe('consumeFixedWindowRateLimit', () => {
  beforeEach(() => {
    __resetRateLimitForTests()
  })

  it('permite request-uri sub limită în aceeași fereastră', () => {
    const first = consumeFixedWindowRateLimit('parse-order:user:user-1', { limit: 2, windowMs: 60_000 }, 1_000)
    const second = consumeFixedWindowRateLimit('parse-order:user:user-1', { limit: 2, windowMs: 60_000 }, 2_000)

    expect(first).toEqual({ allowed: true, retryAfterSeconds: 0 })
    expect(second).toEqual({ allowed: true, retryAfterSeconds: 0 })
  })

  it('blochează request-ul care depășește limita și întoarce retryAfter', () => {
    consumeFixedWindowRateLimit('parse-order:tenant:tenant-1', { limit: 2, windowMs: 60_000 }, 1_000)
    consumeFixedWindowRateLimit('parse-order:tenant:tenant-1', { limit: 2, windowMs: 60_000 }, 2_000)

    const blocked = consumeFixedWindowRateLimit(
      'parse-order:tenant:tenant-1',
      { limit: 2, windowMs: 60_000 },
      3_000,
    )

    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
  })
})
