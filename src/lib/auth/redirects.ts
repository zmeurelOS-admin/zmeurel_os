const FALLBACK_NEXT_PATH = '/dashboard'

function normalizeOrigin(candidate: string | undefined | null): string {
  const raw = (candidate ?? '').trim()
  if (!raw && typeof window !== 'undefined') {
    return window.location.origin
  }

  const trimmed = raw.replace(/\/+$/, '')
  if (!trimmed) return ''

  try {
    return new URL(trimmed).origin
  } catch {
    try {
      return new URL(`https://${trimmed}`).origin
    } catch {
      return typeof window !== 'undefined' ? window.location.origin : ''
    }
  }
}

export function sanitizeNextPath(next: string | null | undefined, fallback = FALLBACK_NEXT_PATH) {
  const candidate = (next ?? '').trim()
  if (!candidate.startsWith('/')) return fallback
  if (candidate.startsWith('//')) return fallback
  return candidate
}

export function buildAuthCallbackUrl(next?: string | null, originOverride?: string | null) {
  const origin = normalizeOrigin(originOverride ?? process.env.NEXT_PUBLIC_SITE_URL)
  const callback = new URL('/auth/callback', origin || 'http://localhost:3000')
  callback.searchParams.set('next', sanitizeNextPath(next))
  return callback.toString()
}

export function buildLoginUrl(options?: { mode?: 'login' | 'register'; next?: string | null }) {
  const params = new URLSearchParams()

  if (options?.mode && options.mode !== 'login') {
    params.set('mode', options.mode)
  }

  const next = sanitizeNextPath(options?.next)
  if (next !== FALLBACK_NEXT_PATH) {
    params.set('next', next)
  }

  const query = params.toString()
  return query ? `/login?${query}` : '/login'
}
