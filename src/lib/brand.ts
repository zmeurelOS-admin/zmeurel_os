/**
 * Numele și adresa platformei, într-un singur loc (promptul 32: Zmeurel OS → Caietul Fermei).
 * Tot ce vede omul și numește platforma ia numele de aici, nu scris de mână.
 *
 * Rămân „Zmeurel” (nu se iau de aici): magazinul de pe `comanda.zmeurel.ro`, „Ferma Zmeurel” și datele fermei
 * lui Andrei. Numele interne (`zmeurel_*` din `localStorage`, antetele `x-zmeurel-*`, cookie-urile, tabelele,
 * evenimentele din analytics) nu se schimbă.
 */
export const APP_NAME = 'Caietul Fermei'

/** Numele scurt: aplicația instalată pe telefon, sigla din antet, textele scurte. */
export const APP_SHORT_NAME = 'Caietul'

/** „Asistentul Caietului Fermei”, „regulile Caietului Fermei”. */
export const APP_NAME_GENITIV = 'Caietului Fermei'

export const APP_TAGLINE = 'Ferma ta, pe telefon. Fără hârtii.'

export const DEFAULT_APP_URL = 'https://caietulfermei.ro'

/** Normalizează o adresă la origine (`https://host`, fără slash la final); `null` dacă nu e validă. */
export function originDinUrl(value: string | null | undefined): string | null {
  const text = value?.trim().replace(/^["']+|["']+$/g, '').trim()
  if (!text) return null
  const httpOrigin = (candidate: string): string | null => {
    try {
      const url = new URL(candidate)
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
      return url.origin && url.origin !== 'null' ? url.origin : null
    } catch {
      return null
    }
  }
  return httpOrigin(text) ?? httpOrigin(`https://${text.replace(/^\/+|\/+$/g, '')}`)
}

/** Adresa platformei, fără slash la final. `NEXT_PUBLIC_SITE_URL`, altfel `https://caietulfermei.ro`. */
export const APP_URL: string = originDinUrl(process.env.NEXT_PUBLIC_SITE_URL) ?? DEFAULT_APP_URL

/** Hostul platformei (`caietulfermei.ro`). */
export const APP_HOST: string = new URL(APP_URL).host

/** Adresa de contact. Cea nouă nu există încă: Andrei schimbă `NEXT_PUBLIC_CONTACT_EMAIL` când o face. */
export const CONTACT_EMAIL: string = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || 'contact@zmeurel.ro'
