import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

import type { NextResponse } from 'next/server'

import {
  DESTRUCTIVE_STEP_UP_HEADER,
  type DestructiveActionScope,
} from '@/lib/auth/destructive-action-step-up-contract'
import { apiError } from '@/lib/api/route-security'

type StatusKey = 'ok' | 'success'

type StepUpIssueInput = {
  userId: string
  scope: DestructiveActionScope
  now?: number
  ttlMs?: number
}

type StepUpVerifyInput = {
  token: string
  userId: string
  scope: DestructiveActionScope
  now?: number
}

type StepUpVerifyResult =
  | { ok: true }
  | {
      ok: false
      reason: 'misconfigured' | 'invalid' | 'expired' | 'replayed'
    }

type StepUpPayload = {
  sub: string
  scp: DestructiveActionScope
  iat: number
  exp: number
  jti: string
}

const STEP_UP_TOKEN_VERSION = 'v1'
const DEFAULT_STEP_UP_TTL_MS = 3 * 60 * 1000
const MIN_SECRET_BYTES = 32
const usedTokenJti = new Map<string, number>()

function cleanupUsedTokens(now: number) {
  for (const [jti, expiresAt] of usedTokenJti.entries()) {
    if (now >= expiresAt) {
      usedTokenJti.delete(jti)
    }
  }
}

function base64UrlDecode(value: string): Buffer {
  return Buffer.from(value, 'base64url')
}

function resolveSecretKey(): Buffer | null {
  const raw = process.env.DESTRUCTIVE_ACTION_STEP_UP_SECRET?.trim()
  if (!raw) return null

  const asUtf8 = Buffer.from(raw, 'utf8')
  if (asUtf8.length >= MIN_SECRET_BYTES) {
    return asUtf8
  }

  try {
    const asBase64 = Buffer.from(raw, 'base64')
    if (asBase64.length >= MIN_SECRET_BYTES) {
      return asBase64
    }
  } catch {
    // ignore invalid base64 and fail closed below
  }

  return null
}

function signPayload(encodedPayload: string, secret: Buffer) {
  return createHmac('sha256', secret)
    .update(`${STEP_UP_TOKEN_VERSION}.${encodedPayload}`)
    .digest('base64url')
}

function safeEqualSignature(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual)
  const expectedBuffer = Buffer.from(expected)
  if (actualBuffer.length !== expectedBuffer.length) {
    return false
  }
  return timingSafeEqual(actualBuffer, expectedBuffer)
}

export function issueDestructiveActionStepUpToken({
  userId,
  scope,
  now = Date.now(),
  ttlMs = DEFAULT_STEP_UP_TTL_MS,
}: StepUpIssueInput): { token: string; expiresAt: number } | null {
  const secret = resolveSecretKey()
  if (!secret) return null

  const issuedAt = now
  const expiresAt = issuedAt + Math.max(30_000, ttlMs)
  const payload: StepUpPayload = {
    sub: userId,
    scp: scope,
    iat: issuedAt,
    exp: expiresAt,
    jti: randomUUID(),
  }

  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const signature = signPayload(encodedPayload, secret)
  return {
    token: `${STEP_UP_TOKEN_VERSION}.${encodedPayload}.${signature}`,
    expiresAt,
  }
}

export function verifyAndConsumeDestructiveActionStepUpToken({
  token,
  userId,
  scope,
  now = Date.now(),
}: StepUpVerifyInput): StepUpVerifyResult {
  const secret = resolveSecretKey()
  if (!secret) {
    return { ok: false, reason: 'misconfigured' }
  }

  const parts = token.split('.')
  if (parts.length !== 3) {
    return { ok: false, reason: 'invalid' }
  }

  const [version, encodedPayload, signature] = parts
  if (version !== STEP_UP_TOKEN_VERSION) {
    return { ok: false, reason: 'invalid' }
  }

  const expectedSignature = signPayload(encodedPayload, secret)
  if (!safeEqualSignature(signature, expectedSignature)) {
    return { ok: false, reason: 'invalid' }
  }

  let payload: StepUpPayload
  try {
    const decoded = base64UrlDecode(encodedPayload).toString('utf8')
    payload = JSON.parse(decoded) as StepUpPayload
  } catch {
    return { ok: false, reason: 'invalid' }
  }

  if (
    typeof payload.sub !== 'string' ||
    typeof payload.scp !== 'string' ||
    typeof payload.iat !== 'number' ||
    typeof payload.exp !== 'number' ||
    typeof payload.jti !== 'string'
  ) {
    return { ok: false, reason: 'invalid' }
  }

  if (payload.sub !== userId || payload.scp !== scope) {
    return { ok: false, reason: 'invalid' }
  }

  if (payload.exp <= payload.iat || now >= payload.exp) {
    return { ok: false, reason: 'expired' }
  }

  cleanupUsedTokens(now)
  if (usedTokenJti.has(payload.jti)) {
    return { ok: false, reason: 'replayed' }
  }
  usedTokenJti.set(payload.jti, payload.exp)

  return { ok: true }
}

export function requireDestructiveActionStepUp(
  request: Request,
  {
    userId,
    scope,
    statusKey = 'ok',
  }: {
    userId: string
    scope: DestructiveActionScope
    statusKey?: StatusKey
  },
): NextResponse | null {
  const token = request.headers.get(DESTRUCTIVE_STEP_UP_HEADER)?.trim()
  if (!token) {
    return apiError(
      403,
      'STEP_UP_REQUIRED',
      'Confirmarea suplimentară este necesară pentru această acțiune.',
      { statusKey },
    )
  }

  const result = verifyAndConsumeDestructiveActionStepUpToken({
    token,
    userId,
    scope,
  })

  if (result.ok) {
    return null
  }

  if (result.reason === 'misconfigured') {
    return apiError(
      503,
      'STEP_UP_UNAVAILABLE',
      'Confirmarea suplimentară nu este disponibilă momentan.',
      { statusKey },
    )
  }

  if (result.reason === 'expired') {
    return apiError(403, 'STEP_UP_EXPIRED', 'Confirmarea a expirat. Reîncearcă.', { statusKey })
  }

  return apiError(
    403,
    'STEP_UP_INVALID',
    'Confirmarea suplimentară este invalidă. Reîncearcă.',
    { statusKey },
  )
}

export function __resetDestructiveActionStepUpForTests() {
  usedTokenJti.clear()
}
