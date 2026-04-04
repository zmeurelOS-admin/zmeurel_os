import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '../../docs/final-browser-qa')
mkdirSync(outDir, { recursive: true })

const routes = [
  { key: 'dashboard', path: '/dashboard', expand: false },
  { key: 'activitati', path: '/activitati-agricole', expand: true },
  { key: 'parcele', path: '/parcele', expand: true },
  { key: 'parcela-detail', path: '/parcele/__FIRST__', expand: false },
  { key: 'cheltuieli', path: '/cheltuieli', expand: false },
  { key: 'investitii', path: '/investitii', expand: true },
  { key: 'culegatori', path: '/culegatori', expand: true },
  { key: 'settings', path: '/settings', expand: false },
]

const themes = ['light', 'dark']
const viewport = { width: 412, height: 915 }

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport, deviceScaleFactor: 2 })
const page = await context.newPage()

const consoleErrors = []
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))
page.on('console', (msg) => {
  if (msg.type() === 'error' || msg.type() === 'warning') consoleErrors.push(`${msg.type()}: ${msg.text()}`)
})

async function bootstrapDemo() {
  await page.goto('http://localhost:3000/start', { waitUntil: 'networkidle', timeout: 90000 })
  await page.getByRole('button', { name: /continuă fără cont/i }).click({ timeout: 30000 })
  await page.getByRole('button', { name: /fructe de pădure/i }).click({ timeout: 30000 })
  await page.waitForURL(/\/dashboard/, { timeout: 180000 })
  await page.waitForTimeout(1500)
}

async function resolveParcelaDetailPath() {
  await page.goto('http://localhost:3000/parcele', { waitUntil: 'networkidle', timeout: 90000 })
  await page.waitForTimeout(1200)
  const href = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href^="/parcele/"]'))
      .map((a) => a.getAttribute('href'))
      .filter((v) => Boolean(v) && v !== '/parcele')
    return links[0] ?? null
  })
  if (href) return href

  const firstCard = page.locator('[data-slot="mobile-entity-card"], [data-mobile-entity-card], a[href="/parcele"]').first()
  if (await firstCard.count()) {
    await firstCard.click({ timeout: 4000 }).catch(() => {})
    await page.waitForTimeout(1000)
  }
  const currentPath = new URL(page.url()).pathname
  return currentPath.startsWith('/parcele/') ? currentPath : '/parcele'
}

async function tryExpand() {
  const card = page.locator('[data-slot="mobile-entity-card"], [role="button"]').first()
  if (await card.count()) {
    await card.click({ timeout: 3000 }).catch(() => {})
    await page.waitForTimeout(700)
  }
}

const report = []
let setupError = null
let parcelaDetailPath = '/parcele'

try {
  await bootstrapDemo()
  parcelaDetailPath = await resolveParcelaDetailPath()
} catch (error) {
  setupError = String(error)
}

if (setupError) {
  await page.screenshot({ path: join(outDir, 'setup-error.png'), fullPage: true })
  report.push({ step: 'bootstrap', error: setupError, url: page.url(), consoleErrors: [...consoleErrors] })
  consoleErrors.length = 0
} else {
  for (const theme of themes) {
    await page.evaluate((nextTheme) => localStorage.setItem('theme', nextTheme), theme)
    for (const route of routes) {
      const resolvedPath = route.path === '/parcele/__FIRST__' ? parcelaDetailPath : route.path
      await page.goto(`http://localhost:3000${resolvedPath}`, { waitUntil: 'networkidle', timeout: 90000 })
      await page.waitForTimeout(1200)

      if (route.expand) await tryExpand()

      const scrollW = await page.evaluate(() => document.documentElement.scrollWidth)
      const clientW = await page.evaluate(() => document.documentElement.clientWidth)
      const overflowX = scrollW > clientW + 2
      const bodyText = await page.locator('body').innerText()
      const hasRuntimeError = /runtime error|\[object object\]/i.test(bodyText)
      const demoVisibleInSettings = route.key === 'settings' ? /Mod demo|Reîncarcă datele demo|Ieși din demo/i.test(bodyText) : false

      const shotName = `${route.key}-${theme}.png`
      await page.screenshot({ path: join(outDir, shotName), fullPage: true })

      report.push({
        route: resolvedPath,
        key: route.key,
        theme,
        overflowX,
        hasRuntimeError,
        demoVisibleInSettings,
        consoleErrors: [...consoleErrors],
      })
      consoleErrors.length = 0
    }
  }
}

writeFileSync(join(outDir, 'report.json'), JSON.stringify({ viewport, setupError, report }, null, 2))
await context.close()
await browser.close()

console.log(JSON.stringify({ outDir, setupError, checks: report.length }, null, 2))
