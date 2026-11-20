/** Prefixul numelui tehnic pe care îl primește o fermă demo la creare (`/api/auth/beta-guest`). */
export const DEMO_FARM_TECHNICAL_PREFIX = 'tenant_demo_'

export const DEMO_FARM_DISPLAY_NAME = 'Ferma demo'

/**
 * Numele fermei așa cum îl vede omul. Rândul din `tenants` rămâne neschimbat:
 * un nume tehnic de demo (`tenant_demo_…`) se arată ca „Ferma demo”.
 */
export function farmDisplayName(name: string | null | undefined): string | null {
  if (typeof name !== 'string') return null
  const trimmed = name.trim()
  if (!trimmed) return null
  if (trimmed.toLowerCase().startsWith(DEMO_FARM_TECHNICAL_PREFIX)) return DEMO_FARM_DISPLAY_NAME
  return trimmed
}
