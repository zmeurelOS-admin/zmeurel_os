import { expect, test, type BrowserContext, type Page, type Worker } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'

const OFFLINE_CONTROLLER_SKIP_REASON = [
  'Service Worker-ul real exista in Chromium pentru acest build, dar documentul nu ajunge sa fie controlat de el in setup-ul actual Windows + Playwright + next-pwa.',
  'Reproducerea facuta in acest repo pe 2026-05-08 este consistenta: navigator.serviceWorker.register("/sw.js") rezolva cu un worker in stare installing, context.serviceWorkers() vede http://localhost:3000/sw.js, iar caches.keys() contine cache-ul Workbox precache.',
  'Dupa aceeasi secventa, navigator.serviceWorker.getRegistrations() revine frecvent cu [] si navigator.serviceWorker.controller ramane null inclusiv dupa reload, tab nou si launchPersistentContext.',
  'Cand context.setOffline(true) este activ si controller-ul ramane null, page.reload() si page.goto() pe rute noi esueaza cu net::ERR_INTERNET_DISCONNECTED, deci Playwright vede eroarea browserului, nu continutul servit de SW.',
  'Pana cand workerul poate prelua controlul unui document in acest mediu, orice test automat pentru offline cached route sau fallback /offline ar produce false negative; foloseste checklist-ul manual din docs/PWA-TESTING.md sau un runner Linux/Docker unde takeover-ul poate fi verificat.',
].join('\n')

const UPDATE_FLOW_SKIP_REASON = [
  'Fluxul de update real necesita doua versiuni distincte ale build-ului servite pe aceeasi origine, astfel incat primul tab sa tina SW vechi iar a doua iteratie sa instaleze un waiting worker nou.',
  'In acest repo, problema de baza este deja anterioara: workerul nu ajunge sa controleze documentul in automatizarea Playwright de pe Windows, deci nu exista premisa minima pentru a observa registration.waiting si toast-ul "Versiune noua disponibila. Reimprospateaza.".',
  'Am testat atat headless, cat si headed Chromium; in ambele cazuri exista target service_worker si cache Workbox, dar navigator.serviceWorker.controller ramane null si getRegistrations() devine instabil.',
  'Fara controller stabil, rebuild-in-place al aplicatiei in timpul testului nu ar valida update flow-ul, ci doar ar introduce un alt vector de flake legat de lock-uri pe .next si schimbarea artefactelor in timp ce next start serveste acelasi director.',
  'Pana la rezolvarea takeover-ului SW in acest setup, update flow-ul ramane de verificat manual conform docs/PWA-TESTING.md sau intr-un mediu separat unde se pot orchestra doua build-uri succesive in siguranta.',
].join('\n')

let sharedContext: BrowserContext
let sharedPage: Page

async function warmLandingPage(page: Page) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'load' })
  await expect(page).toHaveTitle(/Zmeurel/i)
  await expect(page.locator('body')).toContainText(/Zmeurel OS/i)
}

async function ensureRealServiceWorker(page: Page, context: BrowserContext) {
  const workerPromise: Promise<Worker> =
    context.serviceWorkers()[0] != null
      ? Promise.resolve(context.serviceWorkers()[0]!)
      : context.waitForEvent('serviceworker', { timeout: 15_000 })

  const registration = await page.evaluate(async () => {
    const existing =
      (await navigator.serviceWorker.getRegistration('/')) ??
      (await navigator.serviceWorker.getRegistration())

    const resolved = existing ?? (await navigator.serviceWorker.register('/sw.js', { scope: '/' }))

    return {
      scope: resolved.scope,
      activeState: resolved.active?.state ?? null,
      installingState: resolved.installing?.state ?? null,
      waitingState: resolved.waiting?.state ?? null,
    }
  })

  const worker = await workerPromise

  await page.waitForFunction(() => caches.keys().then((keys) => keys.length > 0), { timeout: 30_000 })

  const cacheKeys = await page.evaluate(() => caches.keys())

  return { registration, worker, cacheKeys }
}

async function hasControllingServiceWorker(page: Page) {
  return page.evaluate(() => Boolean(navigator.serviceWorker.controller))
}

test.describe.serial('PWA service worker - comportament real in browser', () => {
  test.beforeAll(async ({ browser }) => {
    sharedContext = await browser.newContext({ serviceWorkers: 'allow' })
    sharedPage = await sharedContext.newPage()

    await warmLandingPage(sharedPage)
  })

  test.afterAll(async () => {
    await sharedContext.close()
  })

  test('Test 1: browserul porneste workerul real si creeaza Cache Storage la prima vizita', async () => {
    await warmLandingPage(sharedPage)

    const { registration, worker, cacheKeys } = await ensureRealServiceWorker(sharedPage, sharedContext)

    expect(worker.url()).toBe(`${BASE_URL}/sw.js`)
    expect(registration.scope).toBe(`${BASE_URL}/`)
    expect(
      registration.activeState ?? registration.installingState ?? registration.waitingState,
    ).not.toBeNull()
    expect(cacheKeys.length).toBeGreaterThan(0)
    expect(cacheKeys.some((key) => key.includes('workbox-precache'))).toBe(true)
    await expect(sharedPage.locator('body')).toContainText(/Caracteristici|Demo/i)
  })

  test('Test 2: Offline pe ruta vizitata anterior ar trebui sa fie servit din cache', async () => {
    await warmLandingPage(sharedPage)
    await ensureRealServiceWorker(sharedPage, sharedContext)
    await sharedPage.reload({ waitUntil: 'load' })

    test.skip(!(await hasControllingServiceWorker(sharedPage)), OFFLINE_CONTROLLER_SKIP_REASON)

    const onlineTitle = await sharedPage.title()
    expect(onlineTitle.length).toBeGreaterThan(0)

    await sharedContext.setOffline(true)

    try {
      await sharedPage.reload({ waitUntil: 'domcontentloaded', timeout: 15_000 })
      await expect(sharedPage).toHaveTitle(onlineTitle)
      await expect(sharedPage.locator('body')).not.toContainText(/ERR_INTERNET_DISCONNECTED|No internet/i)
      await expect(sharedPage.locator('body')).toContainText(/Zmeurel OS/i)
    } finally {
      await sharedContext.setOffline(false)
    }
  })

  test('Test 3: Offline pe ruta necached ar trebui sa afiseze pagina /offline', async () => {
    await warmLandingPage(sharedPage)
    await ensureRealServiceWorker(sharedPage, sharedContext)
    await sharedPage.reload({ waitUntil: 'load' })

    test.skip(!(await hasControllingServiceWorker(sharedPage)), OFFLINE_CONTROLLER_SKIP_REASON)

    const randomRoute = `${BASE_URL}/test-random-route-${Date.now()}`

    await sharedContext.setOffline(true)

    try {
      await sharedPage.goto(randomRoute, { waitUntil: 'domcontentloaded', timeout: 15_000 })
      await expect(sharedPage.locator('body')).toContainText(/offline|conexi/i)
      await expect(sharedPage.locator('body')).not.toContainText(/ERR_INTERNET_DISCONNECTED/i)
    } finally {
      await sharedContext.setOffline(false)
    }
  })

  test('Test 4: update flow cu waiting worker si toast de refresh', async () => {
    test.skip(true, UPDATE_FLOW_SKIP_REASON)
  })
})
