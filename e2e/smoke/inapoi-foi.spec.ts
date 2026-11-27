import { devices, expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'

import { iesiDinCont, pornesteDemoNou } from './demo'

/**
 * Promptul 34, §5: foile (`BottomSheet`) și formularele pe pași (`StepForm`) nu mai scriu în istoric.
 *
 * Pe codul de dinainte, fiecare foaie deschisă punea o intrare nouă (`history.pushState`), iar închiderea din buton,
 * X, salvare sau Esc lăsa intrarea acolo: după 3 foi, „înapoi” trebuia apăsat de 4 ori ca să iasă din fișa parcelei.
 *
 * Verifică, pe fișa Maravilla din demo-ul nou:
 *   - `history.length` nu crește după deschiderea și închiderea foilor pe toate căile (X, Esc, „Editează” din meniu,
 *     salvarea unui stadiu, alegerea din meniu);
 *   - Esc închide foaia;
 *   - după toate, un singur „înapoi” duce la lista de parcele.
 *
 * Scrie doar în demo-ul creat (un stadiu pe Maravilla) și iese din cont la final.
 */

test.describe.configure({ mode: 'serial' })

let context: BrowserContext
let page: Page

const lungimeIstoric = (p: Page) => p.evaluate(() => window.history.length)

async function deschideFisaMaravilla(p: Page) {
  await p.goto('/parcele', { waitUntil: 'load' })
  await p.getByRole('button', { name: /^Maravilla/ }).first().click()
  await expect(p).toHaveURL(/\/parcele\/[^/?]+/)
  await expect(p.getByRole('button', { name: 'Actualizează' })).toBeVisible()
}

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  context = await browser.newContext({ ...devices['Pixel 7'], locale: 'ro-RO', timezoneId: 'Europe/Bucharest' })
  page = await context.newPage()
  await pornesteDemoNou(page)
})

test.afterAll(async ({ baseURL }) => {
  if (page) await iesiDinCont(page, baseURL ?? 'http://localhost:3000')
  await context?.close()
})

test('foile de pe fișa parcelei nu scriu în istoric, Esc le închide, iar „înapoi” iese din prima', async () => {
  await deschideFisaMaravilla(page)
  const inainte = await lungimeIstoric(page)

  // 1. Meniul „⋯” (BottomSheet) închis din X.
  await page.getByRole('button', { name: /^Mai multe acțiuni/ }).click()
  const meniu = page.getByRole('dialog', { name: /^Maravilla/ })
  await expect(meniu).toBeVisible()
  expect.soft(await lungimeIstoric(page), 'deschiderea meniului a scris în istoric').toBe(inainte)
  await meniu.getByRole('button', { name: 'Închide' }).click()
  await expect(meniu).toBeHidden()
  expect.soft(await lungimeIstoric(page), 'meniul închis din X a lăsat o intrare în istoric').toBe(inainte)

  // 2. Meniul „⋯” închis cu Esc.
  await page.getByRole('button', { name: /^Mai multe acțiuni/ }).click()
  await expect(meniu).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(meniu).toBeHidden()
  expect.soft(await lungimeIstoric(page), 'meniul închis cu Esc a lăsat o intrare în istoric').toBe(inainte)

  // 3. Meniul „⋯” → „Editează” (meniul se închide, se deschide formularul) → X.
  await page.getByRole('button', { name: /^Mai multe acțiuni/ }).click()
  await meniu.getByRole('button', { name: /^Editează/ }).click()
  const editare = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Închide' }) }).last()
  await expect(editare).toBeVisible()
  await expect(meniu).toBeHidden()
  await editare.getByRole('button', { name: 'Închide' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect.soft(await lungimeIstoric(page), '„Editează” din meniu a lăsat intrări în istoric').toBe(inainte)

  // 4. Foaia Stadiul (StepForm) închisă cu Esc.
  await page.getByRole('button', { name: 'Actualizează' }).click()
  const stadiu = page.getByRole('dialog', { name: /^Stadiul ·/ })
  await expect(stadiu).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(stadiu).toBeHidden()
  expect.soft(await lungimeIstoric(page), 'Stadiul închis cu Esc a lăsat o intrare în istoric').toBe(inainte)

  // 5. Foaia Stadiul cu salvare (scrie un stadiu în demo) → „Gata”.
  await page.getByRole('button', { name: 'Actualizează' }).click()
  await expect(stadiu).toBeVisible()
  await stadiu.getByRole('radio').first().click()
  await stadiu.getByRole('button', { name: 'Salvează stadiul' }).click()
  await expect(stadiu.getByRole('heading', { name: 'Stadiu salvat' })).toBeVisible()
  await stadiu.getByRole('button', { name: 'Gata' }).click()
  await expect(stadiu).toBeHidden()
  expect.soft(await lungimeIstoric(page), 'salvarea stadiului a lăsat o intrare în istoric').toBe(inainte)

  // 6. Un singur „înapoi” duce la lista de parcele.
  await page.goBack()
  await expect(page).toHaveURL(/\/parcele\/?(\?.*)?$/)
})
