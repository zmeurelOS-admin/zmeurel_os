import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '../../docs/final-browser-qa/mobile-performance')
mkdirSync(outDir, { recursive: true })

const baseUrl = 'http://localhost:3000'
const viewport = { width: 412, height: 915 }
const routes = [
  '/dashboard',
  '/comenzi',
  '/recoltari',
  '/parcele',
  '/activitati-agricole',
  '/stocuri',
  '/cheltuieli',
  '/investitii',
]

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport, deviceScaleFactor: 2 })
const page = await context.newPage()

const routeMetrics = []

async function bootstrapDemo() {
  await page.goto(`${baseUrl}/start`, { waitUntil: 'networkidle', timeout: 120000 })
  await page.getByRole('button', { name: /continuă fără cont/i }).click({ timeout: 30000 })
  await page.getByRole('button', { name: /fructe de pădure/i }).click({ timeout: 30000 })
  await page.waitForURL(/\/dashboard/, { timeout: 180000 })
  await page.waitForTimeout(1200)
}

await bootstrapDemo()
await page.evaluate(() => localStorage.setItem('theme', 'light'))

for (const route of routes) {
  const startedAt = Date.now()
  const requests = []
  const dataRequests = []

  const requestListener = (req) => {
    const url = req.url()
    if (url.startsWith('data:') || url.startsWith('blob:')) return
    const resourceType = req.resourceType()
    requests.push({
      url,
      resourceType,
      method: req.method(),
    })
    if (resourceType === 'xhr' || resourceType === 'fetch') {
      dataRequests.push(url)
    }
  }

  page.on('requestfinished', requestListener)
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForLoadState('networkidle', { timeout: 120000 })
  await page.waitForTimeout(1000)
  page.off('requestfinished', requestListener)

  const endedAt = Date.now()
  const perf = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0]
    const navTiming = nav && 'toJSON' in nav ? nav.toJSON() : null
    const firstPaint = performance.getEntriesByName('first-paint')[0]
    const firstContentfulPaint = performance.getEntriesByName('first-contentful-paint')[0]
    return {
      navTiming,
      fp: firstPaint?.startTime ?? null,
      fcp: firstContentfulPaint?.startTime ?? null,
      domNodes: document.querySelectorAll('*').length,
      hasSkeleton: Boolean(document.querySelector('[class*="animate-pulse"], [data-skeleton], [aria-busy="true"]')),
    }
  })

  const uniqueDataRequests = Array.from(new Set(dataRequests))
  const requestTypeCounts = requests.reduce((acc, item) => {
    acc[item.resourceType] = (acc[item.resourceType] ?? 0) + 1
    return acc
  }, {})
  const requestDomainCounts = requests.reduce((acc, item) => {
    let host = 'unknown'
    try {
      host = new URL(item.url).host
    } catch {
      host = 'invalid'
    }
    acc[host] = (acc[host] ?? 0) + 1
    return acc
  }, {})

  routeMetrics.push({
    route,
    wallTimeMs: endedAt - startedAt,
    requestCount: requests.length,
    dataRequestCount: uniqueDataRequests.length,
    dataRequests: uniqueDataRequests,
    requestTypeCounts,
    requestDomainCounts,
    domNodes: perf.domNodes,
    hasSkeleton: perf.hasSkeleton,
    fpMs: perf.fp,
    fcpMs: perf.fcp,
    domContentLoadedMs: perf.navTiming?.domContentLoadedEventEnd ?? null,
    loadEventMs: perf.navTiming?.loadEventEnd ?? null,
  })
}

writeFileSync(
  join(outDir, 'report.json'),
  JSON.stringify({ viewport, baseUrl, routes: routeMetrics }, null, 2)
)

await context.close()
await browser.close()

console.log(JSON.stringify({ outDir, pages: routeMetrics.length }, null, 2))
