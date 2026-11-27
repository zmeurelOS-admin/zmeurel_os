import { devices, expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'

import { iesiDinCont, pornesteDemoNou } from './demo'
import { cautaTextIesit, descrieProbleme, type ProblemaText } from './text-in-chenar'

/**
 * Promptul 34, §9: ecranele și formularele refăcute, la 360 px (text normal și „Mărimea: Mare”) și la 1440 px,
 * fără buton, placă, câmp sau titlu cu text tăiat ori ieșit din chenar. Un singur demo nou; formularele se deschid
 * și se închid fără salvare (nu scrie nimic). Excepțiile stau în `EXCEPTII_TEXT` (`text-in-chenar.ts`), cu motiv.
 *
 * Lățimile se pot alege: `TEXT_CHENAR=360,360-mare` (implicit toate trei).
 */

type Configurare = { nume: string; mobil: boolean; latime: number; inaltime: number; mare: boolean }

const TOATE: Configurare[] = [
  { nume: '360', mobil: true, latime: 360, inaltime: 800, mare: false },
  { nume: '360-mare', mobil: true, latime: 360, inaltime: 800, mare: true },
  { nume: '1440', mobil: false, latime: 1440, inaltime: 900, mare: false },
]
const alese = (process.env.TEXT_CHENAR ?? '').split(',').map((v) => v.trim()).filter(Boolean)
const CONFIGURARI = alese.length > 0 ? TOATE.filter((c) => alese.includes(c.nume)) : TOATE

type Ecran = { nume: string; deschide: (page: Page) => Promise<void>; inchide?: (page: Page) => Promise<void> }

async function astepta(page: Page) {
  await page.waitForLoadState('networkidle').catch(() => undefined)
  await page.waitForTimeout(400)
}

async function mergiLa(page: Page, url: string) {
  await page.goto(url, { waitUntil: 'load' })
  await expect(page.locator('h1').first()).toBeVisible()
  await astepta(page)
}

async function inchideFereastra(page: Page) {
  for (let i = 0; i < 3 && (await page.getByRole('dialog').count()) > 0; i += 1) {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(250)
    // Confirmarea „Renunți?” din formularele cu ceva scris.
    const renunta = page.getByRole('dialog').getByRole('button', { name: /^Renunță$|^Da, renunț|^Ies fără să salvez/ })
    if (await renunta.count()) await renunta.first().click().catch(() => undefined)
  }
}

async function deschideFisa(page: Page) {
  await mergiLa(page, '/parcele')
  await page.getByRole('button', { name: /^Maravilla/ }).first().click()
  await expect(page.getByRole('button', { name: 'Actualizează' })).toBeVisible()
  await astepta(page)
}

async function apasaPrimul(page: Page, nume: RegExp | string) {
  const buton = page.getByRole('button', { name: nume }).filter({ visible: true }).first()
  await buton.click()
  await expect(page.getByRole('dialog').first()).toBeVisible()
  await astepta(page)
}

const ECRANE: Ecran[] = [
  { nume: 'Acasă', deschide: (p) => mergiLa(p, '/dashboard') },
  { nume: 'Livrări', deschide: (p) => mergiLa(p, '/livrari') },
  { nume: 'Recoltări', deschide: (p) => mergiLa(p, '/recoltari') },
  { nume: 'Comenzi', deschide: (p) => mergiLa(p, '/comenzi') },
  { nume: 'Mai mult', deschide: (p) => mergiLa(p, '/mai-mult') },
  { nume: 'Tratamente · Aplicări', deschide: (p) => mergiLa(p, '/tratamente') },
  { nume: 'Tratamente · Plan', deschide: (p) => mergiLa(p, '/tratamente?tab=plan') },
  { nume: 'Tratamente · Capcane', deschide: (p) => mergiLa(p, '/tratamente?tab=capcane') },
  { nume: 'Tratamente · Analize', deschide: (p) => mergiLa(p, '/tratamente?tab=analize') },
  { nume: 'Magazia', deschide: (p) => mergiLa(p, '/tratamente/magazie') },
  { nume: 'Parcele', deschide: (p) => mergiLa(p, '/parcele') },
  { nume: 'Fișa parcelei', deschide: deschideFisa },
  { nume: 'Lucrări', deschide: (p) => mergiLa(p, '/lucrari') },
  { nume: 'Echipa', deschide: (p) => mergiLa(p, '/settings/echipa') },
  { nume: 'Setări', deschide: (p) => mergiLa(p, '/settings') },
  {
    nume: 'Recoltare nouă',
    deschide: async (p) => {
      await mergiLa(p, '/recoltari')
      await apasaPrimul(p, /Adaugă kg/)
    },
    inchide: inchideFereastra,
  },
  {
    nume: 'Comandă nouă',
    deschide: async (p) => {
      await mergiLa(p, '/comenzi')
      await apasaPrimul(p, /Comandă nouă/)
    },
    inchide: inchideFereastra,
  },
  {
    nume: 'Lucrare nouă · Altele',
    deschide: async (p) => {
      await mergiLa(p, '/lucrari')
      await apasaPrimul(p, /^Lucrare$|Lucrare nouă/)
      await p.getByRole('dialog').getByRole('radio', { name: /Altele/ }).click()
      await p.getByRole('dialog').getByRole('button', { name: 'Continuă' }).click()
      await astepta(p)
    },
    inchide: inchideFereastra,
  },
  {
    nume: 'Tratament nou · metoda',
    deschide: async (p) => {
      await mergiLa(p, '/tratamente')
      await apasaPrimul(p, /Tratament nou/)
    },
    inchide: inchideFereastra,
  },
  {
    nume: 'Magazia · Am cumpărat · Produs nou',
    deschide: async (p) => {
      await mergiLa(p, '/tratamente/magazie')
      await apasaPrimul(p, /Am cumpărat/)
      await p.getByRole('dialog').getByRole('button', { name: /Nu e în listă/ }).click()
      await astepta(p)
    },
    inchide: inchideFereastra,
  },
  {
    nume: 'Stadiul (fișa parcelei)',
    deschide: async (p) => {
      await deschideFisa(p)
      await apasaPrimul(p, 'Actualizează')
    },
    inchide: inchideFereastra,
  },
]

let context: BrowserContext
let page: Page
let stare: Awaited<ReturnType<BrowserContext['storageState']>>

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  context = await browser.newContext({ ...devices['Pixel 7'], locale: 'ro-RO', timezoneId: 'Europe/Bucharest' })
  page = await context.newPage()
  await pornesteDemoNou(page)
  stare = await context.storageState()
})

test.afterAll(async ({ baseURL }) => {
  if (page) await iesiDinCont(page, baseURL ?? 'http://localhost:3000')
  await context?.close()
})

for (const configurare of CONFIGURARI) {
  test(`text în chenar · ${configurare.nume}`, async ({ browser }) => {
    test.setTimeout(15 * 60_000)
    const ctx = await browser.newContext({
      ...(configurare.mobil ? devices['Pixel 7'] : {}),
      viewport: { width: configurare.latime, height: configurare.inaltime },
      locale: 'ro-RO',
      timezoneId: 'Europe/Bucharest',
      storageState: {
        ...stare,
        origins: stare.origins.map((origine) => ({
          ...origine,
          localStorage: [
            ...origine.localStorage.filter((item) => item.name !== 'ui_preferences'),
            { name: 'ui_preferences', value: JSON.stringify({ density: configurare.mare ? 'large' : 'normal' }) },
          ],
        })),
      },
    })
    const p = await ctx.newPage()
    const toate: string[] = []
    try {
      for (const ecran of ECRANE) {
        await test.step(ecran.nume, async () => {
          let probleme: ProblemaText[] = []
          try {
            await ecran.deschide(p)
            probleme = await cautaTextIesit(p)
          } catch (error) {
            toate.push(`[${ecran.nume}] nu s-a putut deschide: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`)
          } finally {
            await (ecran.inchide ?? (async () => undefined))(p).catch(() => undefined)
          }
          if (probleme.length > 0) {
            toate.push(descrieProbleme(ecran.nume, probleme))
            await p.screenshot({ path: test.info().outputPath(`${configurare.nume}-${ecran.nume.replace(/[^\p{L}\d]+/gu, '-')}.png`), fullPage: true }).catch(() => undefined)
          }
        })
      }
    } finally {
      await ctx.close()
    }
    expect(toate, `Text tăiat sau ieșit din chenar (${configurare.nume}):\n${toate.join('\n')}`).toEqual([])
  })
}
