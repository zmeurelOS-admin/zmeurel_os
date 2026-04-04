import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '../../docs/final-browser-qa/mobile-predeploy')
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 })
const page = await context.newPage()

await page.goto('http://localhost:3000/start', { waitUntil: 'networkidle', timeout: 120000 })
await page.getByRole('button', { name: /continuă fără cont/i }).click({ timeout: 30000 })
await page.getByRole('button', { name: /fructe de pădure/i }).click({ timeout: 30000 })
await page.waitForURL(/\/dashboard/, { timeout: 180000 })

await page.goto('http://localhost:3000/parcele', { waitUntil: 'networkidle', timeout: 120000 })
await page.waitForTimeout(1200)

await page.evaluate(() => {
  const candidates = Array.from(document.querySelectorAll('*')).filter((el) => {
    const text = (el.textContent ?? '').trim()
    return /Delniwa Nord|Delniwa Sud|Maravilla|Mure Thornfree|Afine/i.test(text)
  })
  const first = candidates[0]
  if (!first) return
  const clickable =
    first.closest('a[href^="/parcele/"]') ??
    first.closest('button') ??
    first.closest('[role="button"]') ??
    first.closest('div')
  if (clickable instanceof HTMLElement) clickable.click()
})
await page.waitForTimeout(1500)

await page.screenshot({ path: join(outDir, 'parcela-detail-click-check.png'), fullPage: true })
console.log(JSON.stringify({ path: new URL(page.url()).pathname }, null, 2))

await context.close()
await browser.close()
