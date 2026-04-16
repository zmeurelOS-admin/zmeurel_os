import { createHash } from 'node:crypto'
import { isIP } from 'node:net'

type WindowCounter = {
  count: number
  resetAt: number
}

type LimitConfig = {
  limit: number
  windowMs: number
}

type LimitResult = {
  allowed: boolean
  retryAfterSeconds: number
}

type ShopOrderFingerprintInput = {
  tenantId: string
  channel: 'farm_shop' | 'association_shop'
  nume: string
  telefon: string
  locatie: string
  lines: Array<{ produsId: string; qty: number }>
}

const ipBuckets = new Map<string, WindowCounter>()
const fingerprintCooldowns = new Map<string, number>()

function cleanupExpired(now: number) {
  for (const [key, value] of ipBuckets.entries()) {
    if (now > value.resetAt) {
      ipBuckets.delete(key)
    }
  }

  for (const [key, expiresAt] of fingerprintCooldowns.entries()) {
    if (now >= expiresAt) {
      fingerprintCooldowns.delete(key)
    }
  }
}

function normalizeForwardedFor(value: string): string | null {
  const first = value.split(',')[0]?.trim()
  if (!first) return null
  return normalizeIpToken(first)
}

function normalizeForwardedHeader(value: string): string | null {
  const match = /for=(?:"?\[?)([^;\],"]+)/i.exec(value)
  if (!match?.[1]) return null
  return normalizeIpToken(match[1])
}

function normalizeIpToken(value: string): string | null {
  const trimmed = value.trim().replace(/^"+|"+$/g, '').replace(/^\[|\]$/g, '')
  if (!trimmed) return null

  if (isIP(trimmed)) return trimmed

  // common format: ipv4:port
  const ipv4WithoutPort = trimmed.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/)?.[1]
  if (ipv4WithoutPort && isIP(ipv4WithoutPort)) {
    return ipv4WithoutPort
  }

  return null
}

export function extractClientIpFromHeaders(headers: Headers): string {
  const candidates = [
    headers.get('x-vercel-forwarded-for'),
    headers.get('cf-connecting-ip'),
    headers.get('x-forwarded-for'),
    headers.get('x-real-ip'),
    headers.get('x-client-ip'),
    headers.get('forwarded'),
  ].filter((value): value is string => Boolean(value))

  for (const header of candidates) {
    const fromForwardedFor = normalizeForwardedFor(header)
    if (fromForwardedFor) return fromForwardedFor

    const fromForwarded = normalizeForwardedHeader(header)
    if (fromForwarded) return fromForwarded

    const direct = normalizeIpToken(header)
    if (direct) return direct
  }

  return 'unknown'
}

export function consumeFixedWindowLimit(
  key: string,
  config: LimitConfig,
  now = Date.now(),
): LimitResult {
  cleanupExpired(now)

  const current = ipBuckets.get(key)
  if (!current || now > current.resetAt) {
    ipBuckets.set(key, {
      count: 1,
      resetAt: now + config.windowMs,
    })
    return { allowed: true, retryAfterSeconds: 0 }
  }

  if (current.count >= config.limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    }
  }

  current.count += 1
  return { allowed: true, retryAfterSeconds: 0 }
}

export function isFingerprintInCooldown(key: string, now = Date.now()): LimitResult {
  cleanupExpired(now)
  const expiresAt = fingerprintCooldowns.get(key)
  if (!expiresAt || now >= expiresAt) {
    return { allowed: true, retryAfterSeconds: 0 }
  }

  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((expiresAt - now) / 1000)),
  }
}

export function markFingerprintCooldown(
  key: string,
  cooldownMs: number,
  now = Date.now(),
): void {
  cleanupExpired(now)
  fingerprintCooldowns.set(key, now + cooldownMs)
}

function normalizePhone(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase()
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function buildShopOrderFingerprint(input: ShopOrderFingerprintInput): string {
  const canonicalLines = [...input.lines]
    .map((line) => ({
      produsId: line.produsId,
      qty: Math.round(Number(line.qty) * 1000) / 1000,
    }))
    .sort((a, b) => a.produsId.localeCompare(b.produsId))

  const payload = JSON.stringify({
    tenantId: input.tenantId,
    channel: input.channel,
    nume: normalizeText(input.nume),
    telefon: normalizePhone(input.telefon),
    locatie: normalizeText(input.locatie),
    lines: canonicalLines,
  })

  return createHash('sha256').update(payload).digest('hex')
}

export function __resetPublicWriteGuardForTests() {
  ipBuckets.clear()
  fingerprintCooldowns.clear()
}
