type RateLimitCounter = {
  count: number
  resetAt: number
}

type FixedWindowRateLimitConfig = {
  limit: number
  windowMs: number
}

type FixedWindowRateLimitResult = {
  allowed: boolean
  retryAfterSeconds: number
}

const attempts = new Map<string, RateLimitCounter>()

function cleanupExpired(now: number) {
  for (const [key, value] of attempts.entries()) {
    if (now > value.resetAt) {
      attempts.delete(key)
    }
  }
}

export function consumeFixedWindowRateLimit(
  key: string,
  config: FixedWindowRateLimitConfig,
  now = Date.now(),
): FixedWindowRateLimitResult {
  cleanupExpired(now)

  const record = attempts.get(key)

  if (!record || now > record.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + config.windowMs })
    return { allowed: true, retryAfterSeconds: 0 }
  }

  if (record.count >= config.limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((record.resetAt - now) / 1000)),
    }
  }

  record.count += 1
  return { allowed: true, retryAfterSeconds: 0 }
}

export function checkRateLimit(ip: string, limit = 5, windowMs = 60_000): boolean {
  const now = Date.now()
  const normalizedIp = ip.split(',')[0]?.trim() || 'unknown'
  return consumeFixedWindowRateLimit(normalizedIp, { limit, windowMs }, now).allowed
}

export function __resetRateLimitForTests() {
  attempts.clear()
}
