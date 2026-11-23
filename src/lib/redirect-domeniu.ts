/**
 * Redirecționarea adreselor vechi (promptul 32): platforma s-a mutat de pe zmeurel.ro pe caietulfermei.ro.
 * Linkurile vechi există deja în afara aplicației (QR-urile rapoartelor `/a/<token>`, invitațiile operatorilor,
 * linkurile de livrator, aplicațiile instalate), așa că trebuie să meargă în continuare.
 *
 * Funcție pură, chemată primul pas în `src/proxy.ts`, înainte de sesiune: nu citește cookie-uri și nu atinge baza.
 * Merge doar cu `REDIRECT_OLD_DOMAIN=1`; fără el, nimic nu se schimbă.
 *
 * - `zmeurel.ro`, `www.zmeurel.ro`, `app.zmeurel.ro`: orice cale (cu tot cu query) → `APP_URL` + aceeași cale, `308`.
 *   Excepție: `/` de pe `zmeurel.ro` și `www.zmeurel.ro` → magazinul (`https://comanda.zmeurel.ro`):
 *   zmeurel.ro rămâne pagina afacerii lui Andrei.
 * - `www.caietulfermei.ro` → `caietulfermei.ro`, aceeași cale.
 * - Nu se ating: magazinul (`comanda.zmeurel.ro`), preview-urile `*.vercel.app`, `localhost`, `caietulfermei.ro`,
 *   rutele de cron.
 */

export const HOSTURI_VECHI_PLATFORMA = ['zmeurel.ro', 'www.zmeurel.ro', 'app.zmeurel.ro'] as const

/** Hosturile vechi unde `/` e pagina afacerii (magazinul), nu platforma. */
export const HOSTURI_AFACERE = ['zmeurel.ro', 'www.zmeurel.ro'] as const

export const URL_MAGAZIN = 'https://comanda.zmeurel.ro'

export interface CerereRedirect {
  /** Antetul `Host` (cu sau fără port). */
  host: string | null | undefined
  pathname: string
  /** `?x=1` sau gol. */
  search: string
  /** `process.env.REDIRECT_OLD_DOMAIN === '1'`. */
  activ: boolean
  /** Adresa platformei (`APP_URL`), fără slash la final. */
  appUrl: string
  /** Pagina afacerii pentru `/` de pe zmeurel.ro. */
  magazinUrl?: string
}

export function normalizeazaHost(host: string | null | undefined): string {
  return (host ?? '').trim().split(':')[0]?.toLowerCase().replace(/\.$/, '') ?? ''
}

export function flagRedirectActiv(valoare: string | undefined = process.env.REDIRECT_OLD_DOMAIN): boolean {
  return valoare?.trim() === '1'
}

function esteHostVechi(host: string): boolean {
  return (HOSTURI_VECHI_PLATFORMA as readonly string[]).includes(host)
}

function esteHostAfacere(host: string): boolean {
  return (HOSTURI_AFACERE as readonly string[]).includes(host)
}

function esteRutaCron(pathname: string): boolean {
  return pathname === '/api/cron' || pathname.startsWith('/api/cron/')
}

/**
 * Unde se redirecționează cererea (URL absolut, pentru `308`), sau `null` dacă rămâne pe loc.
 * Nu întoarce niciodată o adresă pe același host (fără bucle, chiar dacă `appUrl` e încă zmeurel.ro).
 */
export function destinatieRedirect(cerere: CerereRedirect): string | null {
  if (!cerere.activ) return null
  const host = normalizeazaHost(cerere.host)
  if (!host || esteRutaCron(cerere.pathname)) return null

  let tinta: URL
  try {
    tinta = new URL(cerere.appUrl)
  } catch {
    return null
  }
  const hostPlatforma = tinta.host.toLowerCase()
  const pathname = cerere.pathname.startsWith('/') ? cerere.pathname : `/${cerere.pathname}`
  const search = cerere.search && cerere.search !== '?' ? (cerere.search.startsWith('?') ? cerere.search : `?${cerere.search}`) : ''

  let destinatie: string | null = null
  if (esteHostVechi(host)) {
    destinatie =
      pathname === '/' && esteHostAfacere(host)
        ? `${(cerere.magazinUrl ?? URL_MAGAZIN).replace(/\/$/, '')}/${search}`
        : `${tinta.origin}${pathname}${search}`
  } else if (host === `www.${hostPlatforma}`) {
    destinatie = `${tinta.origin}${pathname}${search}`
  }

  if (!destinatie) return null
  // Fără bucle: o destinație pe același host nu e o redirecționare.
  if (normalizeazaHost(new URL(destinatie).host) === host) return null
  return destinatie
}
