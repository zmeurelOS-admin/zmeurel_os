import { execFile, spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import net from 'node:net'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const PRODUCTION_URL = 'https://zmeurel.ro'
const PREVIEW_URL = 'https://zmeurel-git-perf-bundle-pwa-op-0e8878-zmeurelos-admins-projects.vercel.app'
const VERCEL_PROTECTION_BYPASS_TOKEN = process.env.VERCEL_PROTECTION_BYPASS_TOKEN ?? ''

const ROUTES = ['/', '/start']

const isDesktop = process.argv.includes('--desktop')

const LIGHTHOUSE_COMMAND = process.platform === 'win32' ? 'lighthouse.cmd' : 'lighthouse'

const MOBILE_LIGHTHOUSE_FLAGS = {
  onlyCategories: 'performance',
  formFactor: 'mobile',
  screenWidth: '412',
  screenHeight: '915',
  screenScaleFactor: '2',
  throttlingMethod: 'simulate',
  throttlingRttMs: '150',
  throttlingThroughputKbps: String(10 * 1024),
  throttlingCpuSlowdownMultiplier: '4',
}

const DESKTOP_LIGHTHOUSE_FLAGS = {
  onlyCategories: 'performance',
  formFactor: 'desktop',
  screenWidth: '1440',
  screenHeight: '900',
  screenScaleFactor: '1',
  throttlingMethod: 'simulate',
  throttlingRttMs: '40',
  throttlingThroughputKbps: String(10 * 1024),
  throttlingCpuSlowdownMultiplier: '2',
}

function getChromeCandidates() {
  if (process.platform === 'win32') {
    return [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    ]
  }

  if (process.platform === 'darwin') {
    return [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ]
  }

  return [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    '/usr/bin/microsoft-edge',
  ]
}

async function resolveChromePath() {
  for (const candidate of getChromeCandidates()) {
    try {
      await fs.access(candidate)
      return candidate
    } catch {
      continue
    }
  }

  throw new Error('Nu am găsit Chrome/Edge local pentru Lighthouse.')
}

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close()
        reject(new Error('Nu am putut aloca un port liber pentru Chrome.'))
        return
      }
      const { port } = address
      server.close(() => resolve(port))
    })
    server.on('error', reject)
  })
}

async function waitForPort(port, timeoutMs = 15_000) {
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    const isOpen = await new Promise((resolve) => {
      const socket = net.createConnection({ port, host: '127.0.0.1' })
      socket.once('connect', () => {
        socket.destroy()
        resolve(true)
      })
      socket.once('error', () => resolve(false))
    })

    if (isOpen) return
    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  throw new Error(`Chrome remote debugging port ${port} nu a devenit disponibil la timp.`)
}

async function launchChrome(chromePath) {
  const port = await getFreePort()
  const userDataDir = path.join(
    process.cwd(),
    'scripts',
    'perf',
    '.tmp',
    `chrome-profile-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  )

  await fs.mkdir(userDataDir, { recursive: true })

  const chromeArgs = [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-default-apps',
    '--disable-sync',
    '--disable-extensions',
    '--disable-component-update',
    '--disable-dev-shm-usage',
    '--no-sandbox',
    'about:blank',
  ]

  const child = spawn(chromePath, chromeArgs, {
    stdio: 'ignore',
    windowsHide: true,
  })

  await waitForPort(port)

  return { child, port, userDataDir }
}

async function cleanupChromeSession(session) {
  if (!session) return

  try {
    if (process.platform === 'win32') {
      await execFileAsync('taskkill.exe', ['/PID', String(session.child.pid), '/T', '/F'], {
        timeout: 15_000,
      }).catch(() => {})
    } else {
      session.child.kill('SIGKILL')
    }
  } catch {
    // Best-effort cleanup.
  }

  try {
    await fs.rm(session.userDataDir, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 500,
    })
  } catch {
    // Best-effort cleanup; Windows may keep Crashpad files locked briefly.
  }
}

async function inspectProtection(url) {
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: {
        'user-agent': 'zmeurel-perf-compare/1.0',
      },
    })
    const text = await response.text()
    const protectedByVercel =
      text.includes('Authentication Required') && text.includes('Vercel Authentication')

    return {
      protectedByVercel,
      status: response.status,
      finalUrl: response.url,
    }
  } catch (error) {
    return {
      protectedByVercel: false,
      status: 0,
      finalUrl: url,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function ensureTrailingSlashless(url) {
  return url.endsWith('/') ? url.slice(0, -1) : url
}

function joinUrl(baseUrl, route) {
  const normalizedBase = ensureTrailingSlashless(baseUrl)
  return route === '/' ? `${normalizedBase}/` : `${normalizedBase}${route}`
}

function withBypassToken(url) {
  if (!VERCEL_PROTECTION_BYPASS_TOKEN) return url

  const target = new URL(url)
  target.searchParams.set('x-vercel-set-bypass-cookie', 'true')
  target.searchParams.set('x-vercel-protection-bypass', VERCEL_PROTECTION_BYPASS_TOKEN)
  return target.toString()
}

function formatMs(value) {
  return `${(value / 1000).toFixed(2)} s`
}

function formatBytes(value) {
  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(2)} MB`
  }

  if (value >= 1024) {
    return `${(value / 1024).toFixed(1)} KB`
  }

  return `${value} B`
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(Math.round(value))
}

function metricDescriptor(metric) {
  switch (metric) {
    case 'score':
      return { better: 'higher', type: 'score', label: 'Performance score' }
    case 'fcp':
      return { better: 'lower', type: 'ms', label: 'First Contentful Paint' }
    case 'lcp':
      return { better: 'lower', type: 'ms', label: 'Largest Contentful Paint' }
    case 'tbt':
      return { better: 'lower', type: 'ms', label: 'Total Blocking Time' }
    case 'speedIndex':
      return { better: 'lower', type: 'ms', label: 'Speed Index' }
    case 'jsBytes':
      return { better: 'lower', type: 'bytes', label: 'Total JS size' }
    case 'requestCount':
      return { better: 'lower', type: 'count', label: 'Number of requests' }
    case 'transferBytes':
      return { better: 'lower', type: 'bytes', label: 'Total transfer size' }
    default:
      throw new Error(`Unsupported metric: ${metric}`)
  }
}

function formatMetric(metric, value) {
  const descriptor = metricDescriptor(metric)

  if (descriptor.type === 'score') return `${Math.round(value)}`
  if (descriptor.type === 'ms') return formatMs(value)
  if (descriptor.type === 'bytes') return formatBytes(value)
  return formatNumber(value)
}

function compareMetric(metric, productionValue, previewValue) {
  const descriptor = metricDescriptor(metric)
  const delta = previewValue - productionValue
  const percentBase = productionValue === 0 ? 1 : productionValue
  const percent = (delta / percentBase) * 100
  const absolutePercent = Math.abs(percent)

  let verdict = 'neutral'
  if (absolutePercent < 5) {
    verdict = 'neutral'
  } else if (descriptor.better === 'higher') {
    verdict = delta > 0 ? 'better' : 'worse'
  } else {
    verdict = delta < 0 ? 'better' : 'worse'
  }

  return { delta, percent, verdict }
}

function formatDelta(metric, delta, percent) {
  const sign = delta > 0 ? '+' : ''
  return `${sign}${formatMetric(metric, delta)} (${sign}${percent.toFixed(1)}%)`
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

async function runLighthouse(url, debuggingPort) {
  const runRoot = path.join(
    process.cwd(),
    'scripts',
    'perf',
    '.tmp',
    `run-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  )
  await fs.mkdir(runRoot, { recursive: true })
  const outputPath = path.join(runRoot, 'report.json')

  const flags = isDesktop ? DESKTOP_LIGHTHOUSE_FLAGS : MOBILE_LIGHTHOUSE_FLAGS

  const args = [
    url,
    '--quiet',
    '--output=json',
    `--output-path=${outputPath}`,
    `--port=${debuggingPort}`,
    `--only-categories=${flags.onlyCategories}`,
    `--form-factor=${flags.formFactor}`,
    `--screenEmulation.mobile=${String(!isDesktop)}`,
    `--screenEmulation.width=${flags.screenWidth}`,
    `--screenEmulation.height=${flags.screenHeight}`,
    `--screenEmulation.deviceScaleFactor=${flags.screenScaleFactor}`,
    `--throttling-method=${flags.throttlingMethod}`,
    `--throttling.rttMs=${flags.throttlingRttMs}`,
    `--throttling.throughputKbps=${flags.throttlingThroughputKbps}`,
    `--throttling.cpuSlowdownMultiplier=${flags.throttlingCpuSlowdownMultiplier}`,
  ]

  const command =
    process.platform === 'win32'
      ? { file: 'cmd.exe', args: ['/d', '/s', '/c', LIGHTHOUSE_COMMAND, ...args] }
      : { file: LIGHTHOUSE_COMMAND, args }

  try {
    await execFileAsync(command.file, command.args, {
      timeout: 240_000,
      maxBuffer: 20 * 1024 * 1024,
      env: {
        ...process.env,
        TMP: runRoot,
        TEMP: runRoot,
        TMPDIR: runRoot,
      },
    })
    const raw = await fs.readFile(outputPath, 'utf8')
    return JSON.parse(raw)
  } finally {
    await fs.rm(runRoot, { recursive: true, force: true })
  }
}

function extractMetrics(lhr) {
  const resourceSummary = lhr.audits['resource-summary']?.details?.items ?? []
  const scriptSummary =
    resourceSummary.find((item) => item.resourceType === 'script') ?? {}
  const networkRequests = lhr.audits['network-requests']?.details?.items ?? []

  return {
    score: (lhr.categories.performance?.score ?? 0) * 100,
    fcp: lhr.audits['first-contentful-paint']?.numericValue ?? 0,
    lcp: lhr.audits['largest-contentful-paint']?.numericValue ?? 0,
    tbt: lhr.audits['total-blocking-time']?.numericValue ?? 0,
    speedIndex: lhr.audits['speed-index']?.numericValue ?? 0,
    jsBytes: scriptSummary.transferSize ?? 0,
    requestCount: networkRequests.length,
    transferBytes: lhr.audits['total-byte-weight']?.numericValue ?? 0,
  }
}

function buildSummary(routeResults) {
  const metrics = ['score', 'fcp', 'lcp', 'tbt', 'speedIndex', 'jsBytes', 'requestCount', 'transferBytes']
  const aggregate = {
    better: 0,
    worse: 0,
    neutral: 0,
    scoreDelta: 0,
    jsBytesSaved: 0,
    transferBytesSaved: 0,
  }

  for (const routeResult of routeResults) {
    for (const metric of metrics) {
      const comparison = routeResult.comparisons[metric]
      aggregate[comparison.verdict] += 1
    }

    aggregate.scoreDelta += routeResult.preview.score - routeResult.production.score
    aggregate.jsBytesSaved += routeResult.production.jsBytes - routeResult.preview.jsBytes
    aggregate.transferBytesSaved +=
      routeResult.production.transferBytes - routeResult.preview.transferBytes
  }

  return aggregate
}

function verdictLabel(verdict) {
  if (verdict === 'better') return 'Preview mai bun'
  if (verdict === 'worse') return 'Preview mai slab'
  return 'Diferență mică'
}

function verdictClass(verdict) {
  if (verdict === 'better') return 'better'
  if (verdict === 'worse') return 'worse'
  return 'neutral'
}

function buildHtmlReport({ routeResults, startedAt, generatedAt, summary, modeLabel, warnings }) {
  const rows = routeResults
    .map((routeResult) => {
      const metricOrder = [
        'score',
        'fcp',
        'lcp',
        'tbt',
        'speedIndex',
        'jsBytes',
        'requestCount',
        'transferBytes',
      ]

      const metricRows = metricOrder
        .map((metric) => {
          const descriptor = metricDescriptor(metric)
          const comparison = routeResult.comparisons[metric]

          return `
            <tr class="${verdictClass(comparison.verdict)}">
              <td>${escapeHtml(descriptor.label)}</td>
              <td>${escapeHtml(formatMetric(metric, routeResult.production[metric]))}</td>
              <td>${escapeHtml(formatMetric(metric, routeResult.preview[metric]))}</td>
              <td>${escapeHtml(formatDelta(metric, comparison.delta, comparison.percent))}</td>
              <td>${escapeHtml(verdictLabel(comparison.verdict))}</td>
            </tr>
          `
        })
        .join('')

      return `
        <section class="route-block">
          <h2>Rută: <code>${escapeHtml(routeResult.route)}</code></h2>
          <table>
            <thead>
              <tr>
                <th>Metrică</th>
                <th>Producție</th>
                <th>Preview</th>
                <th>Diferență</th>
                <th>Verdict</th>
              </tr>
            </thead>
            <tbody>
              ${metricRows}
            </tbody>
          </table>
        </section>
      `
    })
    .join('\n')

  return `<!doctype html>
<html lang="ro">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Zmeurel OS Performance Comparison</title>
    <style>
      :root {
        --bg: #f6f5f2;
        --ink: #0c0f13;
        --sub: #4a5261;
        --border: #e6dfd2;
        --good: #0d9b5c;
        --bad: #cf222e;
        --neutral: #b35a00;
        --card: #ffffff;
      }
      body {
        margin: 0;
        font-family: Arial, sans-serif;
        background: linear-gradient(180deg, #f6f5f2, #efe9dc);
        color: var(--ink);
      }
      main {
        max-width: 1120px;
        margin: 0 auto;
        padding: 32px 20px 64px;
      }
      h1, h2, h3 {
        margin: 0 0 12px;
      }
      p, li {
        color: var(--sub);
        line-height: 1.5;
      }
      .summary,
      .route-block,
      .notes {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 18px;
        padding: 20px;
        margin-top: 20px;
        box-shadow: 0 8px 24px rgba(120,100,70,0.08);
      }
      .summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 12px;
      }
      .stat {
        background: #faf8f3;
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 14px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 12px;
      }
      th, td {
        padding: 12px 10px;
        border-bottom: 1px solid var(--border);
        text-align: left;
        vertical-align: top;
      }
      thead th {
        background: #fbf9f5;
      }
      tr.better td:last-child,
      tr.better td:nth-child(4) {
        color: var(--good);
        font-weight: 700;
      }
      tr.worse td:last-child,
      tr.worse td:nth-child(4) {
        color: var(--bad);
        font-weight: 700;
      }
      tr.neutral td:last-child,
      tr.neutral td:nth-child(4) {
        color: var(--neutral);
        font-weight: 700;
      }
      code {
        background: #f2eee6;
        padding: 2px 6px;
        border-radius: 6px;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Zmeurel OS Performance Comparison</h1>
      <p>Rulat la: ${escapeHtml(generatedAt.toLocaleString('ro-RO'))}</p>
      <p>Config: ${escapeHtml(modeLabel)} | Lighthouse performance only | rute publice fără autentificare</p>

      <section class="summary">
        <h2>Summary</h2>
        <div class="summary-grid">
          <div class="stat">
            <strong>Metrici mai bune în preview</strong>
            <div>${summary.better}</div>
          </div>
          <div class="stat">
            <strong>Metrici mai slabe în preview</strong>
            <div>${summary.worse}</div>
          </div>
          <div class="stat">
            <strong>Metrici aproape egale</strong>
            <div>${summary.neutral}</div>
          </div>
          <div class="stat">
            <strong>Delta medie score</strong>
            <div>${(summary.scoreDelta / routeResults.length).toFixed(1)} puncte</div>
          </div>
          <div class="stat">
            <strong>JS estimat economisit</strong>
            <div>${formatBytes(summary.jsBytesSaved)}</div>
          </div>
          <div class="stat">
            <strong>Transfer estimat economisit</strong>
            <div>${formatBytes(summary.transferBytesSaved)}</div>
          </div>
        </div>
        <p>Start: ${escapeHtml(startedAt.toLocaleString('ro-RO'))}</p>
      </section>

      ${
        warnings.length
          ? `<section class="notes">
        <h2>Avertismente de rulare</h2>
        <ul>${warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join('')}</ul>
      </section>`
          : ''
      }

      ${rows}

      <section class="notes">
        <h2>Limitări</h2>
        <ul>
          <li>Sunt testate doar rute publice: <code>/</code> și <code>/start</code>.</li>
          <li>Rutele autentificate nu sunt incluse automat pentru a evita scripturi de login fragile sau credențiale în cod.</li>
          <li>Lighthouse folosește throttling simulat; cifrele sunt comparative, nu identice cu device-urile reale.</li>
        </ul>

        <h3>Checklist manual pentru /dashboard</h3>
        <ul>
          <li>Deschide producția și preview-ul în tab-uri separate, autentificat cu același cont.</li>
          <li>În DevTools Network urmărește: număr total request-uri, Finish time, JS transfer, și absența request-urilor Sentry.</li>
          <li>Compară waterfall-ul inițial după hard refresh cu cache disabled.</li>
          <li>Verifică dacă overlay-urile lazy-load apar după interacțiune și nu blochează first paint.</li>
          <li>Notează diferențele în First Load JS și request-urile către bundle-uri shell non-critice.</li>
        </ul>
      </section>
    </main>
  </body>
</html>`
}

async function main() {
  const startedAt = new Date()
  const chromePath = await resolveChromePath()
  const chromeSession = await launchChrome(chromePath)
  const routeResults = []
  const warnings = []

  console.log(`Using browser: ${chromePath}`)
  console.log(`Mode: ${isDesktop ? 'desktop' : 'mobile'}`)
  if (VERCEL_PROTECTION_BYPASS_TOKEN) {
    console.log('Vercel protection bypass token detected via env.')
  }

  try {
    for (const route of ROUTES) {
      const productionUrl = withBypassToken(joinUrl(PRODUCTION_URL, route))
      const previewUrl = withBypassToken(joinUrl(PREVIEW_URL, route))
      const previewInspection = await inspectProtection(previewUrl)

      if (previewInspection.protectedByVercel) {
        const warning = `Preview ${route} este protejat de Vercel Deployment Protection. Fără VERCEL_PROTECTION_BYPASS_TOKEN, Lighthouse măsoară pagina de autentificare Vercel, nu aplicația.`
        if (!warnings.includes(warning)) warnings.push(warning)
        console.warn(warning)
      }

      console.log(`\n=== Route ${route} ===`)
      console.log(`Running production: ${productionUrl}`)
      const productionLhr = await runLighthouse(productionUrl, chromeSession.port)
      console.log(`Running preview: ${previewUrl}`)
      const previewLhr = await runLighthouse(previewUrl, chromeSession.port)

      const productionMetrics = extractMetrics(productionLhr)
      const previewMetrics = extractMetrics(previewLhr)

      const comparisons = {}
      for (const metric of Object.keys(productionMetrics)) {
        comparisons[metric] = compareMetric(metric, productionMetrics[metric], previewMetrics[metric])
      }

      routeResults.push({
        route,
        production: productionMetrics,
        preview: previewMetrics,
        comparisons,
      })
    }

    const generatedAt = new Date()
    const summary = buildSummary(routeResults)
    const modeLabel = isDesktop
      ? 'Desktop emulation'
      : 'Mobile emulation (412x915, 10 Mbps, 150 ms RTT, 4x CPU slowdown)'
    const html = buildHtmlReport({ routeResults, startedAt, generatedAt, summary, modeLabel, warnings })
    const reportDir = path.join(process.cwd(), 'scripts', 'perf')
    const reportName = `report-${generatedAt.toISOString().slice(0, 10)}${isDesktop ? '-desktop' : ''}.html`
    const reportPath = path.join(reportDir, reportName)

    await fs.mkdir(reportDir, { recursive: true })
    await fs.writeFile(reportPath, html, 'utf8')

    console.log(`\nReport generated: ${reportPath}`)
    console.log('\nSummary table:')
    for (const routeResult of routeResults) {
      console.log(`Route ${routeResult.route}`)
      console.log(
        `  Score: ${formatMetric('score', routeResult.production.score)} -> ${formatMetric('score', routeResult.preview.score)} | ${formatDelta('score', routeResult.comparisons.score.delta, routeResult.comparisons.score.percent)}`,
      )
      console.log(
        `  FCP: ${formatMetric('fcp', routeResult.production.fcp)} -> ${formatMetric('fcp', routeResult.preview.fcp)} | ${formatDelta('fcp', routeResult.comparisons.fcp.delta, routeResult.comparisons.fcp.percent)}`,
      )
      console.log(
        `  LCP: ${formatMetric('lcp', routeResult.production.lcp)} -> ${formatMetric('lcp', routeResult.preview.lcp)} | ${formatDelta('lcp', routeResult.comparisons.lcp.delta, routeResult.comparisons.lcp.percent)}`,
      )
      console.log(
        `  TBT: ${formatMetric('tbt', routeResult.production.tbt)} -> ${formatMetric('tbt', routeResult.preview.tbt)} | ${formatDelta('tbt', routeResult.comparisons.tbt.delta, routeResult.comparisons.tbt.percent)}`,
      )
      console.log(
        `  Speed Index: ${formatMetric('speedIndex', routeResult.production.speedIndex)} -> ${formatMetric('speedIndex', routeResult.preview.speedIndex)} | ${formatDelta('speedIndex', routeResult.comparisons.speedIndex.delta, routeResult.comparisons.speedIndex.percent)}`,
      )
      console.log(
        `  JS size: ${formatMetric('jsBytes', routeResult.production.jsBytes)} -> ${formatMetric('jsBytes', routeResult.preview.jsBytes)} | ${formatDelta('jsBytes', routeResult.comparisons.jsBytes.delta, routeResult.comparisons.jsBytes.percent)}`,
      )
      console.log(
        `  Requests: ${formatMetric('requestCount', routeResult.production.requestCount)} -> ${formatMetric('requestCount', routeResult.preview.requestCount)} | ${formatDelta('requestCount', routeResult.comparisons.requestCount.delta, routeResult.comparisons.requestCount.percent)}`,
      )
      console.log(
        `  Transfer: ${formatMetric('transferBytes', routeResult.production.transferBytes)} -> ${formatMetric('transferBytes', routeResult.preview.transferBytes)} | ${formatDelta('transferBytes', routeResult.comparisons.transferBytes.delta, routeResult.comparisons.transferBytes.percent)}`,
      )
    }
  } finally {
    await cleanupChromeSession(chromeSession)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
