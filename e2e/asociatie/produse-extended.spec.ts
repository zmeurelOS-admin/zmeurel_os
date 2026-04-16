import { expect, test, type Page, type Request } from '@playwright/test'

import { createServiceRoleClient, deleteAuthUserAndTenant } from '../helpers/supabase-admin-e2e'

type AssociationProduseExtendedCtx = {
  service: ReturnType<typeof createServiceRoleClient>
  userId: string
  email: string
  password: string
  tenantId: string
  productListedId: string
  productListedName: string
  productUnlistedId: string
  productUnlistedName: string
  createdProductIds: string[]
}

const ctx: Partial<AssociationProduseExtendedCtx> = { createdProductIds: [] }

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

async function openProductSheet(page: Page, productName: string) {
  await page.locator('tbody tr').filter({ hasText: productName }).first().click()
  const dialog = page.getByRole('dialog').first()
  await expect(dialog).toBeVisible()
  return dialog
}

async function openCreateSheet(page: Page) {
  await page.getByRole('button', { name: '+ Adaugă produs', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: /Adaugă produs/i })
  await expect(dialog).toBeVisible()
  return dialog
}

async function createProductFromSheet(
  page: Page,
  {
    name,
    listed,
  }: {
    name: string
    listed: boolean
  },
) {
  const dialog = await openCreateSheet(page)

  await dialog.getByLabel('Fermier').selectOption(ctx.tenantId!)
  await dialog.getByLabel('Nume produs').fill(name)
  await dialog.getByLabel('Categorie ERP').selectOption('fruct')
  await dialog.getByLabel('Preț (RON)').fill('25')
  await dialog.getByLabel('Unitate de măsură').selectOption('kg')

  const listedSwitch = dialog.getByRole('switch')
  const currentState = await listedSwitch.getAttribute('aria-checked')
  const shouldBeChecked = listed ? 'true' : 'false'
  if (currentState !== shouldBeChecked) {
    await listedSwitch.click()
  }

  const createResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/association/products/create') && response.request().method() === 'POST',
  )

  await dialog.getByRole('button', { name: /^Adaugă produs$/ }).click()
  await createResponse
  await expect(dialog).not.toBeVisible({ timeout: 30_000 })
  await expect(page.locator('tbody tr').filter({ hasText: name }).first()).toBeVisible({ timeout: 30_000 })

  let createdId: string | null = null
  await expect
    .poll(
      async () => {
        const { data } = await ctx.service!
          .from('produse')
          .select('id')
          .eq('tenant_id', ctx.tenantId!)
          .eq('nume', name)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        createdId = data?.id ?? null
        return createdId
      },
      { timeout: 30_000 },
    )
    .not.toBeNull()

  return createdId!
}

// SKIP-CROSS-ASOCIATIE:
// Mediul curent de test este single-workspace pentru asociație. `association_members`
// nu are `association_id`, deci nu putem modela aici două asociații distincte pentru
// un test E2E real cross-asociație fără un al doilea workspace separat.

test.describe('Asociație / Produse — fluxuri extinse', () => {
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

    const email = `${token('association_products_extended_staff')}@example.test`
    const password = `Pwd!${Math.random().toString(36).slice(2, 10)}1A`
    const productListedName = token('Produs listat')
    const productUnlistedName = token('Produs nelistat')

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
        nume_ferma: token('Ferma asociatie extinsa'),
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
      full_name: 'Fermier E2E Asociație Extins',
      legal_type: 'certificat_producator',
      certificate_series: 'SV',
      certificate_number: 'ASOC-E2E-0002',
      certificate_expiry: '2027-12-31',
      locality: 'Suceava',
      phone: '0722000002',
      certificate_photo_url: 'legal-docs/test-farmer-e2e/certificat-extended.jpg',
      legal_accepted_at: new Date().toISOString(),
    })

    if (legalDocsError) {
      await service.from('tenants').delete().eq('id', tenantId)
      await service.from('association_members').delete().eq('user_id', userId)
      await service.auth.admin.deleteUser(userId)
      throw new Error(`Nu am putut crea documentele legale: ${legalDocsError.message}`)
    }

    const { data: listedProduct, error: listedProductError } = await service
      .from('produse')
      .insert({
        tenant_id: tenantId,
        nume: productListedName,
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

    if (listedProductError || !listedProduct?.id) {
      await service.from('farmer_legal_docs').delete().eq('tenant_id', tenantId)
      await service.from('tenants').delete().eq('id', tenantId)
      await service.from('association_members').delete().eq('user_id', userId)
      await service.auth.admin.deleteUser(userId)
      throw new Error(
        `Nu am putut crea produsul listat de test: ${listedProductError?.message || 'unknown error'}`,
      )
    }

    const { data: unlistedProduct, error: unlistedProductError } = await service
      .from('produse')
      .insert({
        tenant_id: tenantId,
        nume: productUnlistedName,
        categorie: 'fruct',
        unitate_vanzare: 'kg',
        pret_unitar: 19,
        status: 'activ',
        association_listed: false,
        association_price: null,
        association_category: 'fructe_legume',
        moneda: 'RON',
      })
      .select('id')
      .single()

    if (unlistedProductError || !unlistedProduct?.id) {
      await service.from('produse').delete().eq('id', listedProduct.id)
      await service.from('farmer_legal_docs').delete().eq('tenant_id', tenantId)
      await service.from('tenants').delete().eq('id', tenantId)
      await service.from('association_members').delete().eq('user_id', userId)
      await service.auth.admin.deleteUser(userId)
      throw new Error(
        `Nu am putut crea produsul nelistat de test: ${unlistedProductError?.message || 'unknown error'}`,
      )
    }

    ctx.service = service
    ctx.userId = userId
    ctx.email = email
    ctx.password = password
    ctx.tenantId = tenantId
    ctx.productListedId = listedProduct.id
    ctx.productListedName = productListedName
    ctx.productUnlistedId = unlistedProduct.id
    ctx.productUnlistedName = productUnlistedName
    ctx.createdProductIds = []
  })

  test.afterAll(async () => {
    if (!ctx.service || !ctx.userId) return

    try {
      const productIds = Array.from(
        new Set(
          [
            ctx.productListedId,
            ctx.productUnlistedId,
            ...(ctx.createdProductIds ?? []),
          ].filter((value): value is string => Boolean(value)),
        ),
      )

      if (productIds.length > 0) {
        await ctx.service.from('produse').delete().in('id', productIds)
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
    await expect(page.locator('tbody tr').filter({ hasText: ctx.productListedName! }).first()).toBeVisible({
      timeout: 30_000,
    })
  })

  test('5.1 toggle listed nu face full page navigation', async ({ page }) => {
    const navigationRequests: string[] = []
    const requestListener = (request: Request) => {
      if (request.resourceType() === 'document' && request.url().includes('/asociatie/produse')) {
        navigationRequests.push(request.url())
      }
    }
    page.on('request', requestListener)

    const dialog = await openProductSheet(page, ctx.productListedName!)
    const listedSwitch = dialog.getByRole('switch')
    await expect(listedSwitch).toHaveAttribute('aria-checked', 'true')

    const toggleOffResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/association/products') && response.request().method() === 'PATCH',
    )
    await listedSwitch.click()
    await toggleOffResponse
    await expect(listedSwitch).toHaveAttribute('aria-checked', 'false')

    const toggleOnResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/association/products') && response.request().method() === 'PATCH',
    )
    await listedSwitch.click()
    await toggleOnResponse
    await expect(listedSwitch).toHaveAttribute('aria-checked', 'true')

    await expect(navigationRequests).toHaveLength(0)
    page.off('request', requestListener)
  })

  test('5.2 creare produs nu face full page navigation', async ({ page }) => {
    const navigationRequests: string[] = []
    const requestListener = (request: Request) => {
      if (request.resourceType() === 'document' && request.url().includes('/asociatie/produse')) {
        navigationRequests.push(request.url())
      }
    }
    page.on('request', requestListener)

    const name = token('Produs fara navigare')
    const createdId = await createProductFromSheet(page, { name, listed: false })
    ctx.createdProductIds!.push(createdId)

    await expect(navigationRequests).toHaveLength(0)
    page.off('request', requestListener)
  })

  test('7.1 produs cu listed=false apare în filtrul Nelistate', async ({ page }) => {
    await page.locator('button:visible').filter({ hasText: 'Nelistate' }).first().click()

    await expect(page.locator('tbody tr').filter({ hasText: ctx.productUnlistedName! })).toHaveCount(1)
    await expect(page.locator('tbody tr').filter({ hasText: ctx.productListedName! })).toHaveCount(0)
  })

  test('7.2 produs cu listed=true apare în filtrul Listate', async ({ page }) => {
    await page.locator('button:visible').filter({ hasText: 'Listate' }).first().click()

    await expect(page.locator('tbody tr').filter({ hasText: ctx.productListedName! })).toHaveCount(1)
    await expect(page.locator('tbody tr').filter({ hasText: ctx.productUnlistedName! })).toHaveCount(0)
  })

  test('6.1 elimina din catalog — rândul rămâne în DB cu association_listed=false', async ({ page }) => {
    const dialog = await openProductSheet(page, ctx.productListedName!)
    const patchResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/association/products') && response.request().method() === 'PATCH',
    )

    await dialog.getByRole('button', { name: 'Elimină din catalog' }).click()
    await expect(page.getByText('Produsul va fi scos din catalogul asociației și nu va mai apărea în magazin.')).toBeVisible()
    await page.getByRole('button', { name: 'Confirmă' }).click()
    await patchResponse

    await expect(dialog).not.toBeVisible({ timeout: 30_000 })

    await expect
      .poll(
        async () => {
          const { data } = await ctx.service!
            .from('produse')
            .select('id, association_listed, association_price')
            .eq('id', ctx.productListedId!)
            .single()
          return data
        },
        { timeout: 30_000 },
      )
      .toEqual({
        id: ctx.productListedId,
        association_listed: false,
        association_price: null,
      })
  })

  test('7.3 produs nou creat cu listed=OFF apare în Nelistate', async ({ page }) => {
    const name = token('Produs nou nelistat')
    const createdId = await createProductFromSheet(page, { name, listed: false })
    ctx.createdProductIds!.push(createdId)

    await page.locator('button:visible').filter({ hasText: 'Nelistate' }).first().click()
    await expect(page.locator('tbody tr').filter({ hasText: name })).toHaveCount(1)
  })

  test('7.4 produs nou creat cu listed=ON apare în Listate', async ({ page }) => {
    const name = token('Produs nou listat')
    const createdId = await createProductFromSheet(page, { name, listed: true })
    ctx.createdProductIds!.push(createdId)

    await page.locator('button:visible').filter({ hasText: 'Listate' }).first().click()
    await expect(page.locator('tbody tr').filter({ hasText: name })).toHaveCount(1)
  })
})
