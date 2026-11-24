/**
 * Din demo spre ferma reală, pe noul /start (rescris în promptul 33): demo nou → „Creează-ți ferma →” din banner
 * (`POST /api/auth/leave-demo`) → sesiunea demo se închide pe server → /start → „Îmi fac cont cu email” → formularul
 * de cont. Fără service role și fără cont real creat (baza e cea de producție): crearea contului, `/start/ferma`
 * (numele și localitatea) și „Primii pași” sunt acoperite de testele unitare și se verifică de mână pe un cont real.
 */
import { expect, test } from '@playwright/test'

import { pornesteDemoNou } from './smoke/demo'

test.describe('Conversie demo → fermă reală', () => {
  test('demo → „Creează-ți ferma” → /start fără sesiune → contul nou cu email', async ({ page }) => {
    test.setTimeout(150_000)
    await pornesteDemoNou(page)

    // Butonul din banner trimite formularul POST spre /api/auth/leave-demo (303 → /start).
    await page.getByTestId('demo-banner-create-farm').click()
    await page.waitForURL(/\/start(\?|$)/, { timeout: 30_000 })
    await expect(page.getByRole('heading', { name: 'Cum vrei să începi?' })).toBeVisible()

    // Sesiunea demo s-a închis: Acasă cere din nou login.
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)

    // Contul nou, a doua opțiune de pe /start.
    await page.goto('/start', { waitUntil: 'load' })
    await page.getByRole('link', { name: 'Îmi fac cont cu email' }).click()
    await expect(page).toHaveURL(/\/login\?mode=register/)
    await expect(page.locator('#register-email')).toBeVisible()
    await expect(page.getByTestId('login-register-submit')).toBeVisible()
  })
})
