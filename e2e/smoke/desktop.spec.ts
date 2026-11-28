import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'

import { iesiDinCont, pornesteDemoNou } from './demo'

/**
 * Promptul 34, §10 (actualizat la 35): desktopul pe interfața nouă, la 1440 × 900, într-un demo nou.
 *   - pe /dashboard, Acasă nouă, fără cardurile vechi și fără „Editează”;
 *   - bara laterală e grupată după treabă (promptul 35, §1) și duce în fiecare modul;
 *   - clopoțelul și contul se deschid din bara laterală;
 *   - o foaie (BottomSheet) se deschide centrată pe ecran.
 * Nu scrie nimic în demo.
 */

test.describe.configure({ mode: 'serial' })

let context: BrowserContext
let page: Page

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ro-RO', timezoneId: 'Europe/Bucharest' })
  page = await context.newPage()
  await pornesteDemoNou(page)
})

test.afterAll(async ({ baseURL }) => {
  if (page) await iesiDinCont(page, baseURL ?? 'http://localhost:3000')
  await context?.close()
})

test('Acasă nouă pe /dashboard, fără cardurile vechi', async () => {
  await page.goto('/dashboard', { waitUntil: 'load' })
  await expect(page.getByRole('heading', { name: 'Acasă', level: 1 })).toBeVisible()
  // Promptul 35, §3: pe desktop Acasă e tabloul de bord (cifrele sezonului și „De făcut”).
  await expect(page.getByRole('region', { name: 'Cifrele sezonului' })).toBeVisible()
  await expect(page.getByText(/^De făcut( azi)?$/).first()).toBeVisible()
  await page.waitForLoadState('networkidle').catch(() => undefined)
  for (const vechi of ['Operațional și recent', 'Recomandări pentru azi', 'Ce ai de făcut azi', 'Meteo azi', 'Magazinul meu']) {
    await expect(page.getByText(vechi, { exact: false }), `pe Acasă mai apare „${vechi}”`).toHaveCount(0)
  }
  await expect(page.getByText('Dashboard', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Editează/ })).toHaveCount(0)
})

test('bara laterală: aceleași nume ca pe telefon și duce în fiecare modul', async () => {
  await page.goto('/dashboard', { waitUntil: 'load' })
  const bara = page.getByRole('complementary', { name: 'Navigare desktop' })
  await expect(bara).toBeVisible()
  const linkuri = bara.getByRole('navigation', { name: 'Module' }).getByRole('link')
  const nume = (await linkuri.evaluateAll((elemente) => elemente.map((el) => el.getAttribute('aria-label') ?? ''))).filter(Boolean)
  // Promptul 35, §1: grupată după treabă — Acasă, Vânzări, Ferma, Bani, apoi Setări jos.
  expect(nume.slice(0, 13)).toEqual([
    'Acasă',
    'Comenzi și livrări',
    'Clienți',
    'Stocuri',
    'Vânzări',
    'Produse',
    'Material săditor',
    'Parcele',
    'Tratamente',
    'Recoltări',
    'Lucrări',
    'Culegători',
    'Bani și rapoarte',
  ])
  for (const asteptat of ['Cheltuieli', 'Investiții', 'Setări']) {
    expect(nume, `lipsește „${asteptat}” din bara laterală`).toContain(asteptat)
  }

  const destinatii = await linkuri.evaluateAll((elemente) =>
    elemente
      .filter((el) => el.getAttribute('target') !== '_blank')
      .map((el) => ({ nume: el.getAttribute('aria-label') ?? '', href: el.getAttribute('href') ?? '' })),
  )
  for (const { nume: numeLink, href } of destinatii) {
    await page.getByRole('complementary', { name: 'Navigare desktop' }).getByRole('link', { name: numeLink, exact: true }).click()
    // `/investitii` redirecționează pe Cheltuieli, fila „Investiții”.
    const asteptata = href === '/investitii' ? /\/cheltuieli\?(?:.*&)?fila=investitii/ : new RegExp(`${href.replace(/[/]/g, '\\/')}(?:[?#].*)?$`)
    await expect(page, `„${numeLink}” nu a dus la ${href}`).toHaveURL(asteptata)
    await expect(page.locator('h1').first(), `„${numeLink}” fără titlu`).toBeVisible()
    await expect(page.getByRole('complementary', { name: 'Navigare desktop' }).getByRole('link', { name: numeLink, exact: true })).toHaveAttribute('aria-current', 'page')
  }
})

test('clopoțelul și contul se deschid din bara laterală', async () => {
  await page.goto('/dashboard', { waitUntil: 'load' })
  const bara = page.getByRole('complementary', { name: 'Navigare desktop' })
  await bara.getByRole('button', { name: /^Notificări/ }).click()
  await expect(page.getByText(/Vezi toate notificările|Nicio notificare/).first()).toBeVisible()
  await page.keyboard.press('Escape')
  await bara.getByRole('button', { name: /^Contul:/ }).click()
  await expect(page.getByRole('menu')).toBeVisible()
  await expect(page.getByRole('menu').getByText('Ieși din cont')).toBeVisible()
  await page.keyboard.press('Escape')
})

test('o foaie se deschide centrată pe ecran (Stocuri → Ajustează)', async () => {
  await page.goto('/stocuri', { waitUntil: 'load' })
  await page.getByRole('button', { name: /Ajustează/ }).first().click()
  const foaie = page.getByRole('dialog').first()
  await expect(foaie).toBeVisible()
  await page.waitForTimeout(500)
  const cutie = await foaie.boundingBox()
  expect(cutie).not.toBeNull()
  const centruX = (cutie?.x ?? 0) + (cutie?.width ?? 0) / 2
  const centruY = (cutie?.y ?? 0) + (cutie?.height ?? 0) / 2
  expect(Math.abs(centruX - 720), 'foaia nu e centrată pe orizontală').toBeLessThan(40)
  expect(Math.abs(centruY - 450), 'foaia nu e centrată pe verticală').toBeLessThan(80)
  await page.keyboard.press('Escape')
  await expect(foaie).toBeHidden()
})
