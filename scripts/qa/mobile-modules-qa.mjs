import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '../../docs/mobile-modules-qa')
mkdirSync(outDir, { recursive: true })

const modules = [
  { key: 'comenzi', path: '/comenzi', expand: false },
  { key: 'recoltari', path: '/recoltari', expand: false },
  { key: 'parcele', path: '/parcele', expand: true },
  { key: 'stocuri', path: '/stocuri', expand: true },
  { key: 'vanzari', path: '/vanzari', expand: true },
]

const themes = ['light', 'dark']
const viewport = { width: 412, height: 915 }

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport, deviceScaleFactor: 2 })
const page = await context.newPage()

const consoleErrors = []
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(`console: ${msg.text()}`)
})

async function bootstrapDemo() {
  await page.goto('http://localhost:3000/start', { waitUntil: 'networkidle', timeout: 60000 })
  await page.getByRole('button', { name: /continuă fără cont/i }).click({ timeout: 30000 })
  await page.getByRole('button', { name: /fructe de pădure/i }).click({ timeout: 30000 })
  await page.waitForURL(/\/dashboard/, { timeout: 180000 })
  await page.waitForTimeout(2000)
}

async function openFirstCardIfAny() {
  const card = page.locator('[data-mobile-entity-card], [role="button"]').filter({ hasText: /./ }).first()
  const count = await card.count()
  if (count === 0) return false
  await card.click({ timeout: 5000 }).catch(() => {})
  await page.waitForTimeout(800)
  return true
}

const report = []
let setupError = null

try {
  await bootstrapDemo()
} catch (error) {
  setupError = String(error)
}

if (setupError) {
  await page.screenshot({ path: join(outDir, 'setup-error.png'), fullPage: true })
  report.push({ step: 'bootstrapDemo', error: setupError, url: page.url(), consoleErrors: [...consoleErrors] })
  consoleErrors.length = 0
} else {
  for (const theme of themes) {
    await page.evaluate((nextTheme) => {
      localStorage.setItem('theme', nextTheme)
    }, theme)

    for (const module of modules) {
      await page.goto(`http://localhost:3000${module.path}`, { waitUntil: 'networkidle', timeout: 90000 })
      await page.waitForTimeout(1500)

      const scrollW = await page.evaluate(() => document.documentElement.scrollWidth)
      const clientW = await page.evaluate(() => document.documentElement.clientWidth)
      const overflowX = scrollW > clientW + 2

      const baseName = `${module.key}-${theme}`
      await page.screenshot({ path: join(outDir, `${baseName}.png`), fullPage: true })

      let expandedShot = null
      if (module.expand) {
        const expanded = await openFirstCardIfAny()
        if (expanded) {
          expandedShot = `${baseName}-expanded.png`
          await page.screenshot({ path: join(outDir, expandedShot), fullPage: true })
        }
      }

      report.push({
        module: module.key,
        route: module.path,
        theme,
        url: page.url(),
        overflowX,
        expandedShot,
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
