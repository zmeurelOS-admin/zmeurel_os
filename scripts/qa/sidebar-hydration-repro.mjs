import { chromium } from '@playwright/test'

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 })
const page = await context.newPage()
const logs = []

page.on('console', (msg) => {
  if (msg.type() === 'error' || msg.type() === 'warning') logs.push(`${msg.type()}: ${msg.text()}`)
})
page.on('pageerror', (err) => logs.push(`pageerror: ${String(err?.message ?? err)}`))

await page.goto('http://localhost:3000/start', { waitUntil: 'networkidle', timeout: 120000 })
await page.getByRole('button', { name: /continuă fără cont/i }).click({ timeout: 30000 })
await page.getByRole('button', { name: /fructe de pădure/i }).click({ timeout: 30000 })
await page.waitForURL(/\/dashboard/, { timeout: 180000 })

await page.evaluate(() => {
  localStorage.setItem('sidebar-collapsed', '1')
})
logs.length = 0
await page.goto('http://localhost:3000/settings', { waitUntil: 'networkidle', timeout: 120000 })
await page.waitForTimeout(1200)

console.log(JSON.stringify({ logs }, null, 2))

await context.close()
await browser.close()
