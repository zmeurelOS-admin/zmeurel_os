import { expect, test, type Page } from '@playwright/test'

import { createServiceRoleClient, deleteAuthUserAndTenant } from '../helpers/supabase-admin-e2e'

type AssociationProduseE2ECtx = {
  service: ReturnType<typeof createServiceRoleClient>
  userId: string
  email: string
  password: string
  tenantId: string
  productId: string
  productName: string
}

const ctx: Partial<AssociationProduseE2ECtx> = {}

function token(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

async function loginViaUi(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.locator('#login-email').fill(email)
  await page.locator('#login-password').fill(password)
  await page.getByRole('button', { name: 'Autentifica-te' }).click()
  await page.waitForURL(/\/(dashboard|start|parcele)/, { timeout: 30_000 })
}

test.describe('Asociație / Produse', () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ viewport: { width: 1366, height: 900 } })

  test.beforeAll(async () => {
    const service = createServiceRoleClient()
    const { error: serviceRoleGuardError } = await service
      .from('produse')
      .select('*', { count: 'exact', head: true })
      .eq('id', '00000000-0000-0000-0000-000000000000')

    if (serviceRoleGuardError) {
      throw new Error(
        `Clientul service role nu funcționează pentru E2E (/produse guard): ${serviceRoleGuardError.message}`,
      )
    }

    const email = `${token('association_products_staff')}@example.test`
    const password = `Pwd!${Math.random().toString(36).slice(2, 10)}1A`
    const productName = token('Produs asociatie')

    const { data: userData, error: userError } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (userError || !userData.user) {
      throw new Error(userError?.message || 'Nu am putut crea userul de test pentru asociație.')
    }

    const userId = userData.user.id

    const { error: memberError } = await service.from('association_members').insert({
      user_id: userId,
      role: 'admin',
    })
    if (memberError) {
      await service.auth.admin.deleteUser(userId)
      throw new Error(`Nu am putut crea membership de asociație: ${memberError.message}`)
    }

    const { data: tenant, error: tenantError } = await service
      .from('tenants')
      .insert({
        owner_user_id: userId,
        nume_ferma: token('Ferma asociatie'),
        plan: 'pro',
        is_association_approved: true,
        is_demo: false,
      })
      .select('id')
      .single()

    if (tenantError || !tenant?.id) {
      await service.from('association_members').delete().eq('user_id', userId)
      await service.auth.admin.deleteUser(userId)
      throw new Error(`Nu am putut crea tenantul de test: ${tenantError?.message || 'unknown error'}`)
    }

    const tenantId = tenant.id

    const { error: legalDocsError } = await service.from('farmer_legal_docs').insert({
      tenant_id: tenantId,
      full_name: 'Fermier E2E Asociație',
      legal_type: 'certificat_producator',
      certificate_series: 'SV',
      certificate_number: 'ASOC-E2E-0001',
      certificate_expiry: '2027-12-31',
      locality: 'Suceava',
      phone: '0722000001',
      certificate_photo_url: 'legal-docs/test-farmer-e2e/certificat.jpg',
      legal_accepted_at: new Date().toISOString(),
    })

    if (legalDocsError) {
      await service.from('tenants').delete().eq('id', tenantId)
      await service.from('association_members').delete().eq('user_id', userId)
      await service.auth.admin.deleteUser(userId)
      throw new Error(`Nu am putut crea documentele legale: ${legalDocsError.message}`)
    }

    const { data: product, error: productError } = await service
      .from('produse')
      .insert({
        tenant_id: tenantId,
        nume: productName,
        categorie: 'fruct',
        unitate_vanzare: 'kg',
        pret_unitar: 25,
        status: 'activ',
        association_listed: true,
        association_price: 25,
        association_category: 'fructe_legume',
        moneda: 'RON',
      })
      .select('id')
      .single()

    if (productError || !product?.id) {
      await service.from('farmer_legal_docs').delete().eq('tenant_id', tenantId)
      await service.from('tenants').delete().eq('id', tenantId)
      await service.from('association_members').delete().eq('user_id', userId)
      await service.auth.admin.deleteUser(userId)
      throw new Error(`Nu am putut crea produsul de test: ${productError?.message || 'unknown error'}`)
    }

    ctx.service = service
    ctx.userId = userId
    ctx.email = email
    ctx.password = password
    ctx.tenantId = tenantId
    ctx.productId = product.id
    ctx.productName = productName
  })

  test.afterAll(async () => {
    if (!ctx.service || !ctx.userId) return

    try {
      if (ctx.productId) {
        await ctx.service.from('produse').delete().eq('id', ctx.productId)
      }
      if (ctx.tenantId) {
        await ctx.service.from('farmer_legal_docs').delete().eq('tenant_id', ctx.tenantId)
        await ctx.service.from('tenants').delete().eq('id', ctx.tenantId)
      }
      await ctx.service.from('association_members').delete().eq('user_id', ctx.userId)
      await deleteAuthUserAndTenant(ctx.service, ctx.userId)
    } catch {
      // cleanup best-effort
    }
  })

  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies()
    await loginViaUi(page, ctx.email!, ctx.password!)
    await page.goto('/asociatie/produse', { waitUntil: 'load' })
    await expect(page.locator('main h1').first()).toHaveText('Produse', { timeout: 30_000 })
    await expect(page.locator('tbody tr').filter({ hasText: ctx.productName! }).first()).toBeVisible({ timeout: 30_000 })
  })

  test('3.1 tabel full-width, fără panou fix', async ({ page }) => {
    const legacyPane = page.locator(
      '[data-testid="desktop-split-pane"], [data-testid="inspector-panel"], [class*="DesktopSplitPane"], [class*="DesktopInspectorPanel"]',
    )

    await expect(legacyPane).toHaveCount(0)
  })

  test('3.2 sheet editare la click pe rând', async ({ page }) => {
    await page.locator('tbody tr').filter({ hasText: ctx.productName! }).first().click()

    const dialog = page.getByRole('dialog').first()
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Preț & Vizibilitate')).toBeVisible()
    await expect(dialog.getByText('Informații alimentare')).toBeVisible()
  })

  test('3.3 buton Adaugă produs prezent și funcțional', async ({ page }) => {
    await expect(page.getByRole('button', { name: '+ Adaugă produs', exact: true })).toBeVisible()
    await page.getByRole('button', { name: '+ Adaugă produs', exact: true }).click()

    const dialog = page.getByRole('dialog', { name: /Adaugă produs/i })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel('Fermier')).toBeVisible()
  })

  test('3.4 validare inline la submit gol', async ({ page }) => {
    await page.getByRole('button', { name: '+ Adaugă produs', exact: true }).click()

    const dialog = page.getByRole('dialog', { name: /Adaugă produs/i })
    await dialog.getByRole('button', { name: /^Adaugă produs$/ }).click()

    await expect(dialog.getByText('Selectează fermierul.')).toBeVisible()
    await expect(dialog.getByText('Introdu numele produsului.')).toBeVisible()
    await expect(dialog.getByText('Introdu prețul.')).toBeVisible()
  })

  test('3.5 mobil 375px, sheet scrollabil', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/asociatie/produse', { waitUntil: 'load' })
    await expect(page.getByRole('button', { name: `Produs ${ctx.productName!}` })).toBeVisible({ timeout: 30_000 })

    await page.getByRole('button', { name: `Produs ${ctx.productName!}` }).click()

    const dialog = page.getByRole('dialog').first()
    await expect(dialog).toBeVisible()

    const metrics = await dialog.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      overflowY: window.getComputedStyle(element).overflowY,
    }))

    expect(['auto', 'scroll']).toContain(metrics.overflowY)
    expect(metrics.scrollHeight).toBeGreaterThanOrEqual(metrics.clientHeight)

    const removeButton = page.getByRole('button', { name: 'Elimină din catalog' })
    await removeButton.scrollIntoViewIfNeeded()
    await expect(removeButton).toBeVisible()
  })
})
