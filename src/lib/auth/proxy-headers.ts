import { DESTRUCTIVE_STEP_UP_HEADER } from '@/lib/auth/destructive-action-step-up-contract'

/**
 * Antetele `x-zmeurel-*` pe care le pune DOAR proxy-ul (identitate, fermă, drepturi). Orice valoare trimisă de
 * browser cu aceste nume se șterge la intrare, ca layout-ul și paginile să nu creadă nimic venit din afară.
 */
const PROXY_OWNED_HEADER_PREFIX = 'x-zmeurel-'

/**
 * Excepțiile: antete `x-zmeurel-*` trimise intenționat de client și citite de rutele API.
 * - `x-zmeurel-step-up-token` (`DESTRUCTIVE_STEP_UP_HEADER`): confirmarea pentru ștergeri (GDPR, resetul fermei).
 * (`git grep "x-zmeurel"`: altele nu există; un antet nou trimis de client se adaugă aici.)
 */
export const CLIENT_SENT_ZMEUREL_HEADERS: ReadonlySet<string> = new Set([DESTRUCTIVE_STEP_UP_HEADER])

export function stripProxyOwnedHeaders(headers: Headers): void {
  const toDelete: string[] = []
  headers.forEach((_value, name) => {
    const lower = name.toLowerCase()
    if (lower.startsWith(PROXY_OWNED_HEADER_PREFIX) && !CLIENT_SENT_ZMEUREL_HEADERS.has(lower)) {
      toDelete.push(name)
    }
  })
  toDelete.forEach((name) => headers.delete(name))
}
