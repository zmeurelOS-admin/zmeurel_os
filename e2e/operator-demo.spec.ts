/**
 * Operatorul din link, într-un demo nou (promptul 33, secțiunea 7): proprietarul demo-ului invită un operator cu
 * „Recoltări: Scrie” și „Tratamente: Citește”, operatorul intră din link („Intră în fermă”, cont ascuns
 * `@operator.zmeurel.local`, legat doar de ferma demo, șters odată cu ea de curățarea demo-urilor) și NU vede bani
 * (Vânzări, Cheltuieli, Rapoarte), nici prețurile din Magazie, nici actele fermei. Totul prin interfață, fără service
 * role. Nu rulează în CI; local, pe `next start` (baza e cea de producție: se scrie doar în demo-ul nou).
 */
import { expect, test } from '@playwright/test'

import { iesiDinCont, pornesteDemoNou } from './smoke/demo'

test('operatorul demo nu vede bani, prețuri din Magazie sau acte', async ({ browser, baseURL }) => {
  test.setTimeout(240_000)
  const proprietar = await browser.newContext()
  const operator = await browser.newContext()
  try {
    const p = await proprietar.newPage()
    await pornesteDemoNou(p)

    // Proprietarul: Magazia arată prețuri (ca termen de comparație).
    await p.goto('/tratamente/magazie', { waitUntil: 'load' })
    await expect(p.getByRole('heading', { name: 'Magazia', level: 1 })).toBeVisible()

    await p.goto('/settings/echipa', { waitUntil: 'load' })
    await p.getByRole('button', { name: 'Invită pe cineva' }).click()
    const formular = p.getByRole('dialog', { name: 'Invită pe cineva' })
    await formular.getByRole('radio', { name: /Operator/ }).click()
    await formular.getByLabel('Nume').fill('Operator de probă')
    await formular.getByRole('button', { name: 'Mai departe' }).click()
    await formular.getByRole('tablist', { name: 'Recoltări: ce poate face' }).getByRole('tab', { name: 'Scrie' }).click()
    await formular.getByRole('tablist', { name: 'Tratamente: ce poate face' }).getByRole('tab', { name: 'Citește' }).click()
    await formular.getByRole('button', { name: 'Generează linkul' }).click()
    const link = ((await formular.getByLabel('Linkul de acces').textContent()) ?? '').trim()
    expect(link).toMatch(/\/invite\/[A-Za-z0-9_-]+$/)
    const cale = new URL(link).pathname

    // Operatorul, în alt browser (fără cookie-urile proprietarului).
    const o = await operator.newPage()
    await o.goto(cale, { waitUntil: 'load' })
    await o.getByRole('button', { name: 'Intră în fermă' }).click()
    await o.waitForURL((url) => !url.pathname.startsWith('/invite'), { timeout: 45_000 })

    // Fără bani: rutele lor nu se deschid (proxy-ul îl trimite la primul modul permis).
    for (const ruta of ['/vanzari', '/cheltuieli', '/rapoarte', '/investitii', '/settings/ferma/acte']) {
      await o.goto(ruta, { waitUntil: 'load' })
      expect(new URL(o.url()).pathname, `Operatorul a deschis ${ruta}`).not.toBe(ruta)
    }

    // Magazia (Tratamente: Citește): stocul da, prețurile nu.
    await o.goto('/tratamente/magazie', { waitUntil: 'load' })
    await expect(o.getByRole('heading', { name: 'Magazia', level: 1 })).toBeVisible()
    await o.waitForLoadState('networkidle').catch(() => undefined)
    const magazie = await o.locator('main').innerText()
    expect(magazie, 'Operatorul vede prețuri în Magazie').not.toMatch(/\d[\d.,]*\s*lei/i)

    // Mai mult: fără Vânzări, Cheltuieli, Rapoarte, Actele fermei.
    await o.goto('/mai-mult', { waitUntil: 'load' })
    const meniu = await o.locator('main').innerText()
    for (const text of ['Vânzări', 'Cheltuieli', 'Rapoarte', 'Actele fermei']) {
      expect(meniu, `Operatorul vede „${text}” în Mai mult`).not.toContain(text)
    }

    await iesiDinCont(o, baseURL as string)
    await iesiDinCont(p, baseURL as string)
  } finally {
    await operator.close()
    await proprietar.close()
  }
})
