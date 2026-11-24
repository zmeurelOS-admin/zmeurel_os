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

/** Hosturile locale, acceptate doar în afara producției. */
const HOSTURI_LOCALE = new Set(['localhost', '127.0.0.1'])

/**
 * Producția = `VERCEL_ENV=production` (promptul 33). `next start` pe calculator nu e producție, deci
 * `http://localhost:3000` rămâne valid acolo. În browser se citește `NEXT_PUBLIC_VERCEL_ENV` (Vercel o expune singur).
 */
export function esteProductie(env: { VERCEL_ENV?: string; NEXT_PUBLIC_VERCEL_ENV?: string } = {
  VERCEL_ENV: process.env.VERCEL_ENV,
  NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
}): boolean {
  return (env.VERCEL_ENV ?? env.NEXT_PUBLIC_VERCEL_ENV)?.trim() === 'production'
}

export type OptiuniOrigine = {
  /** Implicit: `esteProductie()`. În producție, `localhost` / `127.0.0.1` nu se acceptă. */
  productie?: boolean
}

/**
 * Originea unei adrese (`protocol://host[:port]`, fără cale și fără `/` final), sau `null` dacă adresa nu trece
 * regula: după `trim` (și ghilimelele scăpate la copiere), un URL `http:` / `https:` valid, fără utilizator și
 * parolă, al cărui host conține un punct. Excepție: `localhost` și `127.0.0.1`, doar în afara producției.
 * Nu ghicește nimic: `caietulfermei.ro` fără `https://` nu e o adresă. Nu aruncă niciodată.
 */
export function originValida(value: unknown, optiuni: OptiuniOrigine = {}): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim().replace(/^["']+|["']+$/g, '').trim()
  if (!text) return null
  let url: URL
  try {
    url = new URL(text)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (url.username || url.password) return null
  const host = url.hostname.toLowerCase()
  if (!host) return null
  const productie = optiuni.productie ?? esteProductie()
  if (HOSTURI_LOCALE.has(host)) return productie ? null : url.origin
  if (!host.includes('.') || host.startsWith('.') || host.endsWith('.') || host.includes('..')) return null
  if (!url.origin || url.origin === 'null') return null
  return url.origin
}

/** Prima adresă validă dintre cele date (`SITE_URL`, apoi `NEXT_PUBLIC_SITE_URL`…), altfel `null`. */
export function primaOrigineValida(valori: readonly unknown[], optiuni: OptiuniOrigine = {}): string | null {
  for (const valoare of valori) {
    const origine = originValida(valoare, optiuni)
    if (origine) return origine
  }
  return null
}

/**
 * Originea unei adrese din env, sau `https://caietulfermei.ro` dacă adresa nu trece regula (`originValida`).
 * Rezultatul e mereu o origine bună de pus în linkuri; nu aruncă niciodată.
 */
export function originDinUrl(value: unknown, optiuni: OptiuniOrigine = {}): string {
  return originValida(value, optiuni) ?? DEFAULT_APP_URL
}

/** Adresa platformei, fără slash la final. `NEXT_PUBLIC_SITE_URL` dacă e validă, altfel `https://caietulfermei.ro`. */
export const APP_URL: string = originDinUrl(process.env.NEXT_PUBLIC_SITE_URL)

/** Hostul platformei (`caietulfermei.ro`). */
export const APP_HOST: string = new URL(APP_URL).host

/** Adresa de contact. Cea nouă nu există încă: Andrei schimbă `NEXT_PUBLIC_CONTACT_EMAIL` când o face. */
export const CONTACT_EMAIL: string = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || 'contact@zmeurel.ro'
