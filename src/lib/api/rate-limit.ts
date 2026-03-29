const attempts = new Map<string, { count: number; resetAt: number }>()

function cleanupExpired(now: number) {
  for (const [key, value] of attempts.entries()) {
    if (now > value.resetAt) {
      attempts.delete(key)
    }
  }
}

export function checkRateLimit(ip: string, limit = 5, windowMs = 60_000): boolean {
  const now = Date.now()
  cleanupExpired(now)

  const normalizedIp = ip.split(',')[0]?.trim() || 'unknown'
  const record = attempts.get(normalizedIp)

  if (!record || now > record.resetAt) {
    attempts.set(normalizedIp, { count: 1, resetAt: now + windowMs })
    return true
  }

  record.count += 1
  return record.count <= limit
}
