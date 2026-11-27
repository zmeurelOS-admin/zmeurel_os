/**
 * Invitația de instalare în platformă (promptul 34, §4). Logica e comună cu magazinul (`PWAInstallPrompt`), care
 * folosește doar `esteInstalata`; cheile și regulile magazinului rămân ale lui.
 *
 * Regula benzii din Acasă: doar cont real (proprietar sau operator, nu demo), aplicația neinstalată, de la a doua zi
 * de folosire sau după prima salvare, închisă = ascunsă 30 de zile. Totul se ține pe dispozitiv (`localStorage`).
 */

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

/** Cât stă ascunsă banda după „Nu acum” / X. */
export const ZILE_ASCUNSA = 30
const CHEIE = 'zmeurel_instalare'

export interface StareInstalare {
  /** Prima zi de folosire (`YYYY-MM-DD`, ora României). */
  primaZi: string | null
  /** A salvat cel puțin un formular. */
  aSalvat: boolean
  /** Când a închis banda (ms). */
  inchisaLa: number | null
}

const STARE_GOALA: StareInstalare = { primaZi: null, aSalvat: false, inchisaLa: null }

/** Ziua de azi în ora României. */
export function ziRo(acum: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest' }).format(acum)
}

/** Aplicația rulează instalată (de pe ecranul telefonului). */
export function esteInstalata(): boolean {
  if (typeof window === 'undefined') return false
  const navigatorCuStandalone = window.navigator as Navigator & { standalone?: boolean }
  return Boolean(window.matchMedia?.('(display-mode: standalone)').matches) || navigatorCuStandalone.standalone === true
}

/** iPhone / iPad (Safari): fără prompt de instalare, doar instrucțiuni. */
export function esteIphone(userAgent: string): boolean {
  return /iphone|ipad|ipod/i.test(userAgent) || (/macintosh/i.test(userAgent) && /mobile/i.test(userAgent))
}

/** Banda din Acasă se arată? Funcție pură. */
export function aratBanda(input: {
  demo: boolean
  instalata: boolean
  stare: StareInstalare
  azi: string
  acum: number
}): boolean {
  if (input.demo || input.instalata) return false
  const { primaZi, aSalvat, inchisaLa } = input.stare
  if (inchisaLa !== null && input.acum - inchisaLa < ZILE_ASCUNSA * 86_400_000) return false
  return aSalvat || (primaZi !== null && input.azi > primaZi)
}

export function citesteStare(): StareInstalare {
  if (typeof window === 'undefined') return STARE_GOALA
  try {
    const brut = window.localStorage.getItem(CHEIE)
    if (!brut) return STARE_GOALA
    const parsat = JSON.parse(brut) as Partial<StareInstalare>
    return {
      primaZi: typeof parsat.primaZi === 'string' ? parsat.primaZi : null,
      aSalvat: parsat.aSalvat === true,
      inchisaLa: typeof parsat.inchisaLa === 'number' ? parsat.inchisaLa : null,
    }
  } catch {
    return STARE_GOALA
  }
}

function scrieStare(stare: StareInstalare) {
  try {
    window.localStorage.setItem(CHEIE, JSON.stringify(stare))
  } catch {
    // Fără spațiu sau fără acces: banda nu apare, nimic altceva nu se strică.
  }
  notifica()
}

/** Notează prima zi de folosire (o singură dată). */
export function noteazaFolosirea(azi: string = ziRo()) {
  if (typeof window === 'undefined') return
  const stare = citesteStare()
  if (stare.primaZi === null) scrieStare({ ...stare, primaZi: azi })
}

/** Prima salvare reușită a unui formular (din `useStepForm.markSuccess`). */
export function semnaleazaSalvare() {
  if (typeof window === 'undefined') return
  const stare = citesteStare()
  if (!stare.aSalvat) scrieStare({ ...stare, aSalvat: true, primaZi: stare.primaZi ?? ziRo() })
}

/** „Nu acum” / X: banda se ascunde 30 de zile. */
export function inchideBanda(acum: number = Date.now()) {
  scrieStare({ ...citesteStare(), inchisaLa: acum })
}

// ─── Promptul de instalare (Android / Chrome) ──────────────────────────────────

let promptAmanat: BeforeInstallPromptEvent | null = null
let instalataAcum = false
let ascultat = false
const abonati = new Set<() => void>()

function notifica() {
  for (const abonat of abonati) abonat()
}

/** Se cheamă o dată, devreme (layout-ul platformei): `beforeinstallprompt` vine o singură dată pe încărcare. */
export function ascultaInstalarea() {
  if (ascultat || typeof window === 'undefined') return
  ascultat = true
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    promptAmanat = event as BeforeInstallPromptEvent
    notifica()
  })
  window.addEventListener('appinstalled', () => {
    promptAmanat = null
    instalataAcum = true
    notifica()
  })
}

export function aboneazaInstalarea(abonat: () => void) {
  abonati.add(abonat)
  return () => {
    abonati.delete(abonat)
  }
}

export function arePromptInstalare(): boolean {
  return promptAmanat !== null
}

export function instalataInSesiune(): boolean {
  return instalataAcum
}

/** Deschide promptul sistemului. `true` = omul a acceptat. */
export async function cereInstalarea(): Promise<boolean> {
  const prompt = promptAmanat
  if (!prompt) return false
  await prompt.prompt()
  const alegere = await prompt.userChoice
  if (alegere.outcome === 'accepted') {
    promptAmanat = null
    notifica()
    return true
  }
  return false
}
