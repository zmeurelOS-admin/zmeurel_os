import { expect, type Page } from '@playwright/test'

/**
 * Ajutoarele setului smoke. Totul trece prin interfață: demo-ul se creează din `/start`, nu cu service role,
 * și nu se citește sau scrie nimic în afara lui.
 */

/** Erorile de consolă care nu vin din aplicație (rețea, extensii, avertizări ale browserului). */
const ZGOMOT_CONSOLA = [
  /Failed to load resource/i, // un 4xx/5xx de rețea apare și ca cerere; îl verificăm separat dacă e nevoie
  /favicon/i,
  /Download the React DevTools/i,
  /net::ERR_/i,
  /\[PWA\]/i,
  /service ?worker/i,
  /Content Security Policy/i,
  // Vercel Analytics / Speed Insights: scripturile există doar pe Vercel, local dau 404.
  /_vercel\//i,
  /Vercel (Web Analytics|Speed Insights)/i,
]

export function esteEroareDinAplicatie(text: string): boolean {
  return !ZGOMOT_CONSOLA.some((re) => re.test(text))
}

/** Adună erorile de consolă din aplicație (și excepțiile nerinse din pagină). */
export function ascultaErori(page: Page): string[] {
  const erori: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error' && esteEroareDinAplicatie(msg.text())) erori.push(msg.text())
  })
  page.on('pageerror', (error) => erori.push(`pageerror: ${error.message}`))
  return erori
}

/**
 * Demo nou: întâi iese din orice sesiune (cookie-urile contextului sunt oricum goale la pornire), apoi
 * `/start` → „Încearcă o fermă demo” → „Fructe de pădure” (aleasă) → „Pornește demo-ul” → ecranul de așteptare
 * (pașii bifați pe rând) → Acasă, abia când datele se văd (promptul 31).
 */
export async function pornesteDemoNou(page: Page): Promise<void> {
  await page.context().clearCookies()
  await page.goto('/start', { waitUntil: 'load' })
  await page.getByRole('button', { name: /Încearcă o fermă demo/ }).click()
  await expect(page.getByRole('radio', { name: /Fructe de pădure/ })).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('button', { name: 'Pornește demo-ul' }).click()
  await expect(page.getByRole('heading', { name: 'Pregătim ferma demo…' })).toBeVisible()
  await page.waitForURL(/\/dashboard/, { timeout: 90_000 })
}

/** Ieșirea din cont pe server (`POST /api/auth/sign-out`), cu cookie-urile paginii. */
export async function iesiDinCont(page: Page, baseURL: string): Promise<void> {
  const raspuns = await page.request.post('/api/auth/sign-out', {
    headers: { origin: baseURL, referer: `${baseURL}/dashboard` },
    maxRedirects: 0,
  })
  expect([200, 303]).toContain(raspuns.status())
}

/** Data de azi, `YYYY-MM-DD`, în fusul României. */
export function aziRo(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest' }).format(new Date())
}
