/**
 * Intrarea în aplicație pe noul /start (promptul 31, rescris în promptul 33): demo-ul primul, ecranul de așteptare,
 * contul nou a doua opțiune, gărzile fără sesiune. Totul prin interfață: fără service role, fără conturi reale create
 * sau șterse. Singurul lucru scris e un demo nou (din /start), din care se iese la final.
 *
 * Contul real cu email / Google, `/start/ferma` după cont și „Primii pași” cer un cont real nou: nu se creează aici
 * (baza e cea de producție). Sunt acoperite de testele unitare (`cont-nou`, `primii-pasi`, `PrimiiPasiCard`); aici se
 * verifică doar că ecranele există și că gărzile trimit unde trebuie.
 */
import { expect, test } from '@playwright/test'

import { iesiDinCont, pornesteDemoNou } from './smoke/demo'

test.describe('Onboarding pe noul /start', () => {
  test('fără sesiune: /dashboard și /start/ferma duc la Login', async ({ page, context }) => {
    await context.clearCookies()
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
    await page.goto('/start/ferma')
    await expect(page).toHaveURL(/\/login/)
  })

  test('/start: demo-ul primul, apoi contul nou și „Am deja cont”', async ({ page, context }) => {
    await context.clearCookies()
    await page.goto('/start', { waitUntil: 'load' })
    await expect(page.getByRole('heading', { name: 'Cum vrei să începi?' })).toBeVisible()
    const demo = page.getByRole('button', { name: /Încearcă o fermă demo/ })
    const email = page.getByRole('link', { name: 'Îmi fac cont cu email' })
    await expect(demo).toBeVisible()
    await expect(page.getByRole('button', { name: /Îmi fac cont cu Google/ })).toBeVisible()
    await expect(email).toBeVisible()
    await expect(page.getByRole('link', { name: 'Intră' })).toHaveAttribute('href', '/login')
    // Demo-ul e deasupra contului nou.
    const yDemo = (await demo.boundingBox())?.y ?? 0
    const yEmail = (await email.boundingBox())?.y ?? 0
    expect(yDemo).toBeLessThan(yEmail)
  })

  test('/start → „Îmi fac cont cu email”: formularul de cont, fără „numele fermei” (îl cere /start/ferma)', async ({ page, context }) => {
    await context.clearCookies()
    await page.goto('/start', { waitUntil: 'load' })
    await page.getByRole('link', { name: 'Îmi fac cont cu email' }).click()
    await expect(page).toHaveURL(/\/login\?mode=register/)
    await expect(page.locator('#register-email')).toBeVisible()
    await expect(page.locator('#register-password')).toBeVisible()
    await expect(page.locator('#register-farm')).toHaveCount(0)
    await expect(page.getByTestId('login-register-submit')).toBeVisible()
  })

  test('?demo=1 deschide direct tipul demo-ului (Fructe de pădure ales)', async ({ page, context }) => {
    await context.clearCookies()
    await page.goto('/start?demo=1', { waitUntil: 'load' })
    await expect(page.getByRole('radio', { name: /Fructe de pădure/ })).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByRole('radio', { name: /Solarii/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Pornește demo-ul' })).toBeVisible()
  })

  test('demo nou: ecranul de așteptare, apoi Acasă cu date; fără „Primii pași” (doar fermă reală)', async ({ page, baseURL }) => {
    test.setTimeout(150_000)
    await pornesteDemoNou(page)
    await expect(page.getByText(/Ești în modul demo/)).toBeVisible()
    await expect(page.getByText('Primii pași')).toHaveCount(0)
    // Cu sesiunea demo, /start/ferma nu e pentru demo: înapoi în Acasă.
    await page.goto('/start/ferma')
    await expect(page).toHaveURL(/\/dashboard/)
    await iesiDinCont(page, baseURL as string)
  })
})
