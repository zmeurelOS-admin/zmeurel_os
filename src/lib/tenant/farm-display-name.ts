/** Prefixul numelui tehnic pe care îl primește o fermă demo la creare (`/api/auth/beta-guest`). */
export const DEMO_FARM_TECHNICAL_PREFIX = 'tenant_demo_'

export const DEMO_FARM_DISPLAY_NAME = 'Ferma demo'

export const FARM_FALLBACK_DISPLAY_NAME = 'Ferma'

/** Un nume intern, nu unul pus de om: `tenant_demo_4723a180`, `tenant_ab12cd34`, `tenant_…`. */
const NUME_INTERN = /^tenant_[a-z0-9_-]*$/i

/**
 * Numele fermei așa cum îl vede omul. Rândul din `tenants` rămâne neschimbat:
 * un nume tehnic de demo (`tenant_demo_…`) se arată ca „Ferma demo”, orice alt nume intern (`tenant_…`) ca „Ferma”.
 * `null` dacă nu e niciun nume.
 */
export function farmDisplayName(name: string | null | undefined): string | null {
  if (typeof name !== 'string') return null
  const trimmed = name.trim()
  if (!trimmed) return null
  if (trimmed.toLowerCase().startsWith(DEMO_FARM_TECHNICAL_PREFIX)) return DEMO_FARM_DISPLAY_NAME
  if (NUME_INTERN.test(trimmed)) return FARM_FALLBACK_DISPLAY_NAME
  return trimmed
}

/**
 * Numele afișat, mereu un text: numele fermei, altfel „Ferma demo” pentru demo și „Ferma” pentru restul
 * (numele lipsește sau e intern). Folosit unde numele apare public (raportul analizei, PDF, afiș).
 */
export function farmDisplayNameOrFallback(name: string | null | undefined, options: { demo?: boolean } = {}): string {
  const afisat = farmDisplayName(name)
  if (afisat && afisat !== FARM_FALLBACK_DISPLAY_NAME) return afisat
  return options.demo ? DEMO_FARM_DISPLAY_NAME : FARM_FALLBACK_DISPLAY_NAME
}
