/**
 * Capturile reale pentru prima pagină (promptul 31): un demo NOU „Fructe de pădure”, creat din `/start` (ca un
 * om), la lățime de telefon (390 px, 2×), zi. Scrie doar în demo-ul lui, iese din cont la final.
 *
 * Rulare (serverul local pornit, de preferat `npm run build` + `npx next start -p 3000`):
 *   node scripts/landing-capturi.mjs            # http://localhost:3000
 *   BASE_URL=http://localhost:3001 node scripts/landing-capturi.mjs
 *
 * Ieșire: `public/landing/captura-<pagina>.webp` (Acasă, Recoltări, Comenzi, Tratamente, Stocuri, Parcele).
 * Atenție: serverul local folosește baza de producție; scriptul nu atinge nimic în afara demo-ului creat.
 */
import { chromium } from '@playwright/test'
import sharp from 'sharp'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const PAGINI = [
  ['acasa', '/dashboard'],
  ['recoltari', '/recoltari'],
  ['comenzi', '/comenzi'],
  ['tratamente', '/tratamente'],
  ['stocuri', '/stocuri'],
  ['parcele', '/parcele'],
]

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 390, height: 780 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'ro-RO',
  timezoneId: 'Europe/Bucharest',
  colorScheme: 'light',
  // Service workerul reîncarcă pagina la prima instalare: îl oprim, ca navigările să nu se calce.
  serviceWorkers: 'block',
})
const page = await context.newPage()

try {
  await page.goto(`${BASE_URL}/start`, { waitUntil: 'load' })
  await page.getByRole('button', { name: /Încearcă o fermă demo/ }).click()
  await page.getByRole('button', { name: 'Pornește demo-ul' }).click()
  await page.waitForURL(/\/dashboard/, { timeout: 120_000, waitUntil: 'load' })
  await page.waitForTimeout(3000)
  // Fără widgetul beta și bannerul de notificări peste capturi.
  await page.evaluate(() => {
    try {
      window.localStorage.setItem('zmeurel_beta_dismissed', '1')
    } catch {}
  })

  for (const [nume, ruta] of PAGINI) {
    await page.goto(`${BASE_URL}${ruta}`, { waitUntil: 'load' })
    await page.waitForLoadState('networkidle').catch(() => undefined)
    await page.waitForTimeout(1500)
    const png = await page.screenshot({ type: 'png' })
    await sharp(png).webp({ quality: 78 }).toFile(`public/landing/captura-${nume}.webp`)
    console.log(`✓ ${nume}`)
  }
} finally {
  await page.request.post(`${BASE_URL}/api/auth/sign-out`, { headers: { origin: BASE_URL, referer: `${BASE_URL}/dashboard` }, maxRedirects: 0 }).catch(() => undefined)
  await browser.close()
}
