/**
 * INTERNAL QA — nu face parte din CI sau din fluxul produsului.
 *
 * Capturi full-page pentru /dashboard în 4 combinații (viewport × theme).
 * Un singur flux demo (sau login prin env) → apoi reload per captură.
 *
 * Run (dev server pe localhost:3000):
 *   node scripts/qa/dashboard-screenshots.mjs
 *
 * Output: docs/dashboard-qa-screenshots/*.png
 *
 * Opțional — login în loc de demo:
 *   PLAYWRIGHT_DASHBOARD_EMAIL=… PLAYWRIGHT_DASHBOARD_PASSWORD=… node scripts/qa/dashboard-screenshots.mjs
 */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '../../docs/dashboard-qa-screenshots')

const shots = [
  { id: 'mobile-light', width: 412, height: 915, theme: 'light' },
  { id: 'mobile-dark', width: 412, height: 915, theme: 'dark' },
  { id: 'desktop-light', width: 1280, height: 900, theme: 'light' },
  { id: 'desktop-dark', width: 1280, height: 900, theme: 'dark' },
]

mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({ headless: true })

const context = await browser.newContext({
  viewport: { width: 412, height: 915 },
  deviceScaleFactor: 2,
})

const page = await context.newPage()
const consoleErrors = []
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(`console: ${msg.text()}`)
})

async function reachDashboard() {
  const email = process.env.PLAYWRIGHT_DASHBOARD_EMAIL
  const password = process.env.PLAYWRIGHT_DASHBOARD_PASSWORD
  if (email && password) {
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle', timeout: 60000 })
    await page.locator('#email, #login-email').first().fill(email)
    await page.locator('#password, #login-password').first().fill(password)
    await page.getByRole('button', { name: /autentific|intra/i }).first().click()
    await page.waitForURL(/\/(dashboard|start)/, { timeout: 60000 })
    return
  }

  await page.goto('http://localhost:3000/start', { waitUntil: 'networkidle', timeout: 60000 })
  await page.getByRole('button', { name: /continuă fără cont/i }).click({ timeout: 30000 })
  await page.getByRole('button', { name: /fructe de pădure/i }).click({ timeout: 30000 })
  await page.waitForURL(/\/dashboard/, { timeout: 180000 })
}

let setupError = null
try {
  await reachDashboard()
  await page.waitForTimeout(3000)
} catch (e) {
  setupError = String(e)
}

const report = []
if (setupError) {
  await page.screenshot({ path: join(outDir, 'setup-error.png'), fullPage: true })
  report.push({ step: 'reachDashboard', error: setupError, url: page.url(), consoleErrors })
}

if (!setupError) {
  for (const shot of shots) {
    await page.setViewportSize({ width: shot.width, height: shot.height })
    await page.evaluate((theme) => {
      localStorage.setItem('theme', theme)
    }, shot.theme)
    await page.reload({ waitUntil: 'networkidle', timeout: 90000 })
    await page.waitForTimeout(2000)

    const scrollW = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientW = await page.evaluate(() => document.documentElement.clientWidth)
    const overflowX = scrollW > clientW + 2

    await page.screenshot({ path: join(outDir, `${shot.id}.png`), fullPage: true })

    report.push({
      id: shot.id,
      finalUrl: page.url(),
      overflowX,
      consoleErrors: [...consoleErrors],
    })
    consoleErrors.length = 0
  }
}

await context.close()
await browser.close()

console.log(JSON.stringify({ outDir, report, setupError }, null, 2))
