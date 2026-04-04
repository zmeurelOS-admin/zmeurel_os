import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '../../docs/final-browser-qa/mobile-stability')
mkdirSync(outDir, { recursive: true })

const baseUrl = 'http://localhost:3000'
const viewport = { width: 412, height: 915 }
const routes = [
  '/dashboard',
  '/activitati-agricole',
  '/parcele',
  '/recoltari',
  '/comenzi',
  '/vanzari',
  '/stocuri',
  '/cheltuieli',
  '/investitii',
  '/culegatori',
  '/settings',
]

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport, deviceScaleFactor: 2 })
await context.addInitScript(() => {
  window.__zmeurelUnhandled = []
  window.addEventListener('unhandledrejection', (event) => {
    window.__zmeurelUnhandled.push(String(event.reason?.message ?? event.reason ?? 'unknown rejection'))
  })
})
const page = await context.newPage()

const logs = []
const capture = (entry) => logs.push({ ts: Date.now(), ...entry })
page.on('pageerror', (error) => capture({ type: 'pageerror', text: String(error?.message ?? error) }))
page.on('console', (msg) => {
  const type = msg.type()
  if (type === 'error' || type === 'warning') {
    capture({ type: `console:${type}`, text: msg.text() })
  }
})

async function bootstrapDemo() {
  await page.goto(`${baseUrl}/start`, { waitUntil: 'networkidle', timeout: 120000 })
  await page.getByRole('button', { name: /continuă fără cont/i }).click({ timeout: 30000 })
  await page.getByRole('button', { name: /fructe de pădure/i }).click({ timeout: 30000 })
  await page.waitForURL(/\/dashboard/, { timeout: 180000 })
  await page.waitForTimeout(1200)
}

async function getFirstParcelaIdFromNetwork() {
  let parcelaId = null
  const onResponse = async (res) => {
    try {
      const url = res.url()
      if (!url.includes('/rest/v1/parcele?')) return
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0 && data[0]?.id) {
        parcelaId = String(data[0].id)
      }
    } catch {
      // ignore parse issues
    }
  }

  page.on('response', onResponse)
  await page.goto(`${baseUrl}/parcele`, { waitUntil: 'networkidle', timeout: 120000 })
  await page.waitForTimeout(1000)
  page.off('response', onResponse)
  return parcelaId
}

function classifySeverity(text) {
  const t = text.toLowerCase()
  if (t.includes('hydration') || t.includes('didn\'t match') || t.includes('unhandled') || t.includes('runtime error')) {
    return 'should-fix-now'
  }
  if (t.includes('deprecated') || t.includes('warning')) return 'safe-to-postpone'
  return 'investigate'
}

await bootstrapDemo()
await page.evaluate(() => localStorage.setItem('theme', 'light'))

const routeFindings = []

for (const route of routes) {
  logs.length = 0
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle', timeout: 120000 })
  await page.waitForTimeout(900)
  const unhandled = await page.evaluate(() => window.__zmeurelUnhandled ?? [])
  const entries = [...logs, ...unhandled.map((text) => ({ type: 'unhandledrejection', text }))]
  routeFindings.push({ flow: 'demo', route, entries })
}

const firstParcelaId = await getFirstParcelaIdFromNetwork()
if (firstParcelaId) {
  logs.length = 0
  await page.goto(`${baseUrl}/parcele/${firstParcelaId}`, { waitUntil: 'networkidle', timeout: 120000 })
  await page.waitForTimeout(900)
  const unhandled = await page.evaluate(() => window.__zmeurelUnhandled ?? [])
  const entries = [...logs, ...unhandled.map((text) => ({ type: 'unhandledrejection', text }))]
  routeFindings.push({ flow: 'demo', route: `/parcele/${firstParcelaId}`, entries })
}

// Try switching from demo to non-demo flow (best effort).
let nonDemoReached = false
let nonDemoNote = null
try {
  await page.goto(`${baseUrl}/settings`, { waitUntil: 'networkidle', timeout: 120000 })
  await page.waitForTimeout(600)
  const exitBtn = page.getByRole('button', { name: /ieși din demo/i })
  if (await exitBtn.count()) {
    await exitBtn.first().click({ timeout: 5000 })
    const confirm = page.getByRole('button', { name: /^Ieși din demo$/i })
    if (await confirm.count()) {
      await confirm.first().click({ timeout: 5000 })
      await page.waitForTimeout(1600)
    }
  }

  await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'networkidle', timeout: 120000 })
  await page.waitForTimeout(900)
  const bodyText = await page.locator('body').innerText()
  const hasDemoBanner = /ești în modul demo/i.test(bodyText)
  nonDemoReached = !hasDemoBanner
  nonDemoNote = nonDemoReached ? 'Demo banner no longer visible after exit flow.' : 'Exit demo did not remove banner in this session.'
} catch (error) {
  nonDemoNote = `Non-demo transition not confirmed: ${String(error)}`
}

if (nonDemoReached) {
  for (const route of ['/dashboard', '/settings']) {
    logs.length = 0
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle', timeout: 120000 })
    await page.waitForTimeout(900)
    const unhandled = await page.evaluate(() => window.__zmeurelUnhandled ?? [])
    const entries = [...logs, ...unhandled.map((text) => ({ type: 'unhandledrejection', text }))]
    routeFindings.push({ flow: 'non-demo', route, entries })
  }
}

const normalized = routeFindings.map((row) => ({
  ...row,
  entries: row.entries.map((entry) => ({
    ...entry,
    severity: classifySeverity(entry.text),
  })),
}))

writeFileSync(
  join(outDir, 'report.json'),
  JSON.stringify(
    {
      viewport,
      baseUrl,
      nonDemoReached,
      nonDemoNote,
      findings: normalized,
    },
    null,
    2
  )
)

await context.close()
await browser.close()

console.log(JSON.stringify({ outDir, checks: normalized.length, nonDemoReached }, null, 2))
