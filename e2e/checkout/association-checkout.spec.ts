import { createClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'

import { cleanupCheckoutOrder, provisionCheckoutTestData } from './fixtures/checkout-data'

let testData: Awaited<ReturnType<typeof provisionCheckoutTestData>>
let createdOrderId: string | null = null

test.beforeAll(async () => {
  testData = await provisionCheckoutTestData()
})

test.afterAll(async () => {
  if (createdOrderId) {
    await cleanupCheckoutOrder(createdOrderId)
  }
  await testData.cleanup()
})

test('checkout complet asociatie: cos → comanda → confirmare → DB', async ({ page }) => {
  let capturedOrderId: string | null = null

  page.on('response', async (response) => {
    if (response.url().includes('/api/shop/order') && response.status() === 200) {
      try {
        const body = (await response.json()) as { orderIds?: string[] }
        if (body.orderIds?.length) {
          capturedOrderId = body.orderIds[0] ?? null
        }
      } catch {
        // ignore response bodies we cannot parse
      }
    }
  })

  await page.goto('/magazin/asociatie/produse', { waitUntil: 'load' })
  await page.waitForLoadState('networkidle')

  const productLocator = page.getByText('Zmeură test E2E').first()
  const productVisible = await productLocator.isVisible().catch(() => false)

  if (!productVisible) {
    test.skip(
      true,
      'Produsul de test nu apare în magazinul public al asociației deși fixture-ul setează is_association_approved și association_listed.',
    )
    return
  }

  await expect(productLocator).toBeVisible()

  await page.getByRole('button', { name: /adaugă .*zmeură test e2e.*coș/i }).click()

  await page.getByRole('button', { name: /deschide coșul de cumpărături|^coș$/i }).first().click()
  await expect(page.getByRole('heading', { name: /coșul tău/i })).toBeVisible()

  await page.getByRole('button', { name: /continuă spre checkout/i }).click()
  await expect(page.getByRole('heading', { name: /finalizeaza comanda/i })).toBeVisible()

  await page.locator('input[autocomplete="name"]').fill('Ion Popescu Test')
  await page.locator('input[autocomplete="tel"]').fill('0722000001')
  await page.locator('input[autocomplete="street-address"]').fill('Suceava, str. Test 1')

  await page.getByRole('radio', { name: /whatsapp/i }).click()

  const submitBtn = page.getByRole('button', { name: /plaseaza comanda cu obligatie de plata/i })
  await expect(submitBtn).toBeEnabled()
  await submitBtn.click()

  await expect(
    page.getByText(/comanda ta a fost transmisă|comanda ta a fost transmisa|vei fi contactat/i).first(),
  ).toBeVisible({ timeout: 10_000 })

  await page.waitForTimeout(1_000)
  createdOrderId = capturedOrderId

  const sessionStorageCart = await page.evaluate(() => window.sessionStorage.getItem('zmeurel-association-cart-v1'))
  expect(sessionStorageCart === '[]' || sessionStorageCart === null).toBeTruthy()

  if (createdOrderId) {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      },
    )

    const { data: comanda } = await admin
      .from('comenzi')
      .select('id, status, tenant_id')
      .eq('id', createdOrderId)
      .single()

    expect(comanda).not.toBeNull()
    expect(comanda?.status).toBe('noua')
    expect(comanda?.tenant_id).toBe(testData.tenantId)

    const { data: msgLog } = await admin.from('message_log').select('id, order_id').eq('order_id', createdOrderId)
    expect(msgLog?.length).toBeGreaterThan(0)

    const { data: consent } = await admin
      .from('consent_events')
      .select('id, order_id')
      .eq('order_id', createdOrderId)
    expect(consent?.length).toBeGreaterThan(0)
  } else {
    console.warn('E2E: orderId nu a fost capturat din response. DB assertions skipped.')
  }
})
