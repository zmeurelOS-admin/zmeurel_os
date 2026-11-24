import { DEFAULT_APP_URL, originValida } from '@/lib/brand'

const FALLBACK_NEXT_PATH = '/dashboard'

/**
 * Originea adresei de întoarcere: valoarea dată, dacă trece regula din `originValida` (promptul 33), altfel
 * originea paginii din browser, altfel adresa platformei. Nu ghicește `https://` în fața unei valori stricate.
 */
function normalizeOrigin(candidate: string | undefined | null): string {
  const valida = originValida(candidate)
  if (valida) return valida
  if (typeof window !== 'undefined') return window.location.origin
  return DEFAULT_APP_URL
}

export function sanitizeNextPath(next: string | null | undefined, fallback = FALLBACK_NEXT_PATH) {
  const candidate = (next ?? '').trim()
  if (!candidate.startsWith('/')) return fallback
  if (candidate.startsWith('//')) return fallback
  return candidate
}

export function buildAuthCallbackUrl(next?: string | null, originOverride?: string | null) {
  const origin = normalizeOrigin(originOverride ?? process.env.NEXT_PUBLIC_SITE_URL)
  const callback = new URL('/auth/callback', origin)
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
