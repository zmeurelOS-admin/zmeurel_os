/**
 * Contul nou (promptul 31): după înscriere, o singură întrebare — numele fermei și localitatea (`/start/ferma`).
 * Funcții pure, testate.
 *
 * Ferma se creează la înscriere de triggerul `on_auth_user_created` (`handle_auth_user_created`: profilul, ferma
 * cu numele din `farm_name` / `full_name` / „Ferma mea”). Nu se creează nicio parcelă, niciun produs și nicio cultură.
 */
export const RUTA_FERMA_NOUA = '/start/ferma'

/** Cât timp după crearea fermei mai arătăm întrebarea, dacă nu are localitate (Google: prima intrare). */
export const FEREASTRA_FERMA_NOUA_MS = 15 * 60_000

/** Numele puse automat la înscriere, care nu spun nimic despre fermă. */
export function esteNumeImplicit(nume: string | null | undefined): boolean {
  const text = String(nume ?? '').trim()
  if (!text) return true
  if (text === 'Ferma mea') return true
  if (/^tenant_demo_/i.test(text)) return true
  return /'s Farm$/.test(text)
}

/** Ferma tocmai creată, încă fără localitate: întrebăm numele și locul. */
export function esteFermaNoua(
  ferma: { created_at: string | null; localitate: string | null },
  acum: number = Date.now(),
): boolean {
  if (ferma.localitate?.trim()) return false
  const creata = ferma.created_at ? Date.parse(ferma.created_at) : Number.NaN
  if (!Number.isFinite(creata)) return false
  return acum - creata >= 0 && acum - creata <= FEREASTRA_FERMA_NOUA_MS
}

/** Numele propus în câmp: cel ales de om, nu unul pus automat. */
export function numePropus(nume: string | null | undefined): string {
  return esteNumeImplicit(nume) ? '' : String(nume).trim()
}
