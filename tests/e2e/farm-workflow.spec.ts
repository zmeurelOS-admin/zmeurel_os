import { expect, test, type Locator, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

type WorkflowUser = {
  id: string
  email: string
  password: string
}

type WorkflowContext = {
  service: SupabaseClient
  user: WorkflowUser
  tenantId: string
}

const ctx: Partial<WorkflowContext> = {}
const TEST_TEREN_NAME = 'Test Solar'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

function uniqueToken(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function getCtx(): WorkflowContext {
  if (!ctx.service || !ctx.user || !ctx.tenantId) {
    throw new Error('Farm workflow context is not initialized')
  }
  return ctx as WorkflowContext
}

function parseRoNumber(input: string): number {
  const raw = input.replace(/\s/g, '')
  const cleaned = raw.replace(/[^\d,.-]/g, '')
  const normalized = cleaned.replace(/\./g, '').replace(',', '.')
  const value = Number(normalized)
  return Number.isFinite(value) ? value : 0
}

async function createWorkflowUser(service: SupabaseClient): Promise<WorkflowUser> {
  const email = `${uniqueToken('farm_workflow')}@example.test`
  const password = `Pwd!${Math.random().toString(36).slice(2, 10)}1A`

  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error || !data.user) {
    throw new Error(`Failed creating workflow user: ${error?.message ?? 'unknown error'}`)
  }

  return { id: data.user.id, email, password }
}

async function loginViaUi(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/')
  await page.goto('/login')
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.getByRole('button', { name: /intra|login/i }).click()
}

async function openDemoAndSeed(page: Page): Promise<void> {
  await page.goto('/')

  const demoEntry = page.getByRole('link', { name: /intra in demo|intra in demo/i })
  if (await demoEntry.count()) {
    await demoEntry.first().click()
  } else {
    await page.goto('/start')
  }

  await expect(page.getByText(/Testeaza Zmeurel OS in modul demo|Testeaza Zmeurel OS/i)).toBeVisible({ timeout: 20000 })

  const seedResponsePromise = page.waitForResponse((response) => {
    const request = response.request()
    return request.method() === 'POST' && response.url().includes('/api/demo/seed')
  })

  await page.getByRole('button', { name: /Porneste demo|Porneste/i }).first().click()
  const seedResponse = await seedResponsePromise
  expect(seedResponse.status()).toBe(200)
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 })
}

async function getDashboardHarvestTodayKg(page: Page): Promise<number> {
  const card = page.locator('button').filter({ hasText: /Recoltat azi/i }).first()
  await expect(card).toBeVisible({ timeout: 20000 })
  const text = (await card.textContent()) ?? ''
  const match = text.match(/([\d.,]+)\s*kg/i)
  return match ? parseRoNumber(match[1]) : 0
}

async function getStocCal1Kg(page: Page): Promise<number> {
  await page.goto('/stoc')
  await expect(page.getByText(/Stoc Cal 1 disponibil/i)).toBeVisible({ timeout: 20000 })
  const text = await page.locator('body').innerText()
  const match = text.match(/Stoc Cal 1 disponibil\s*([\d.,]+)\s*kg/i)
  if (!match) {
    throw new Error('Could not parse "Stoc Cal 1 disponibil" from /stoc page')
  }
  return parseRoNumber(match[1])
}

async function selectOptionByText(trigger: Locator, page: Page, optionRegex: RegExp): Promise<void> {
  await trigger.click()
  await page.getByRole('option', { name: optionRegex }).first().click()
}

async function selectFirstUsableOption(trigger: Locator, page: Page): Promise<void> {
  await trigger.click()
  const options = page.locator('[role="option"]')
  const count = await options.count()
  for (let i = 0; i < count; i += 1) {
    const option = options.nth(i)
    const text = ((await option.textContent()) ?? '').trim()
    if (!text) continue
    if (/Selecteaz/i.test(text)) continue
    await option.click()
    return
  }
  throw new Error('No selectable option found')
}

async function selectNativeOptionByText(page: Page, selectId: string, optionText: RegExp): Promise<void> {
  const option = page.locator(`${selectId} option`).filter({ hasText: optionText }).first()
  await expect(option).toBeVisible({ timeout: 15000 })
  const value = await option.getAttribute('value')
  if (!value) throw new Error(`No selectable value found for ${selectId}`)
  await page.selectOption(selectId, value)
}

test.describe('Farm workflow end-to-end', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

    const service = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    })

    const user = await createWorkflowUser(service)
    const { data: tenant, error: tenantError } = await service
      .from('tenants')
      .insert({
        nume_ferma: uniqueToken('farm_workflow_ferma'),
        owner_user_id: user.id,
        plan: 'pro',
      })
      .select('id')
      .single()

    if (tenantError || !tenant?.id) {
      throw new Error(`Failed creating workflow tenant: ${tenantError?.message ?? 'unknown error'}`)
    }

    ctx.service = service
    ctx.user = user
    ctx.tenantId = tenant.id
  })

  test.afterAll(async () => {
    if (!ctx.service) return
    const c = getCtx()

    try {
      await c.service.from('vanzari').delete().eq('tenant_id', c.tenantId)
      await c.service.from('recoltari').delete().eq('tenant_id', c.tenantId)
      await c.service.from('comenzi').delete().eq('tenant_id', c.tenantId)
      await c.service.from('cheltuieli_diverse').delete().eq('tenant_id', c.tenantId)
      await c.service.from('activitati_agricole').delete().eq('tenant_id', c.tenantId)
      await c.service.from('clienti').delete().eq('tenant_id', c.tenantId)
      await c.service.from('culegatori').delete().eq('tenant_id', c.tenantId)
      await c.service.from('parcele').delete().eq('tenant_id', c.tenantId)
      await c.service.from('tenants').delete().eq('id', c.tenantId)
      await c.service.auth.admin.deleteUser(c.user.id)
    } catch {
      // no-op teardown
    }
  })

  test('Demo onboarding -> create terrain/activity/harvest/sale -> verify stock and dashboard totals', async ({ page }) => {
    const c = getCtx()

    await loginViaUi(page, c.user.email, c.user.password)
    await openDemoAndSeed(page)
    await expect(page.getByRole('heading', { name: /Dashboard/i })).toBeVisible({ timeout: 15000 })

    const baselineKg = await getDashboardHarvestTodayKg(page)

    await page.goto('/parcele')
    await page.getByRole('button', { name: /Adauga teren/i }).first().click()

    const unitateTrigger = page.locator('button[role="combobox"]').first()
    await selectOptionByText(unitateTrigger, page, /^Solar$/i)
    await page.fill('#nume_parcela', TEST_TEREN_NAME)

    const culturaTrigger = page.locator('button[role="combobox"]').nth(1)
    await selectFirstUsableOption(culturaTrigger, page)

    await page.fill('#suprafata_m2', '500')
    await page.getByRole('button', { name: /Salveaza/i }).last().click()
    await expect(page.getByText(TEST_TEREN_NAME)).toBeVisible({ timeout: 20000 })

    await page.goto('/activitati-agricole')
    await page.getByRole('button', { name: /Adauga activitate/i }).first().click()
    await selectNativeOptionByText(page, '#act_parcela', new RegExp(TEST_TEREN_NAME, 'i'))
    await selectNativeOptionByText(page, '#act_tip', /Copilit/i)
    await page.getByRole('button', { name: /Salveaza/i }).last().click()
    await expect(page.getByText(/Activitate salvata/i)).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/Copilit/i).first()).toBeVisible({ timeout: 15000 })

    await page.goto('/recoltari')
    await page.getByRole('button', { name: /Adauga recoltare/i }).first().click()
    await selectOptionByText(page.locator('#recoltare_parcela'), page, new RegExp(TEST_TEREN_NAME, 'i'))
    await selectFirstUsableOption(page.locator('#recoltare_culegator'), page)
    await page.fill('#recoltare_kg_cal1', '10')
    await page.fill('#recoltare_kg_cal2', '3')
    await page.getByRole('button', { name: /Salveaza/i }).last().click()
    await expect(page.getByText(/Recoltare adaugata/i)).toBeVisible({ timeout: 15000 })

    const stockBeforeSaleCal1 = await getStocCal1Kg(page)

    await page.goto('/vanzari')
    await page.getByRole('button', { name: /Adauga vanzare/i }).first().click()
    await page.fill('#v_qty', '5')
    await page.fill('#v_price', '30')
    await page.getByRole('button', { name: /Salveaza/i }).last().click()
    await expect(page.getByText(/Vanzare adaugata/i)).toBeVisible({ timeout: 15000 })

    const stockAfterSaleCal1 = await getStocCal1Kg(page)
    expect(stockAfterSaleCal1).toBeLessThanOrEqual(stockBeforeSaleCal1 - 5)

    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: /Dashboard/i })).toBeVisible({ timeout: 15000 })
    const updatedKg = await getDashboardHarvestTodayKg(page)
    expect(updatedKg).toBeGreaterThanOrEqual(baselineKg + 13)
  })

  test('mobile viewport renders navigation and cards', async ({ page }) => {
    const c = getCtx()
    await page.setViewportSize({ width: 375, height: 812 })
    await loginViaUi(page, c.user.email, c.user.password)
    await page.goto('/dashboard')

    await expect(page.getByRole('heading', { name: /Dashboard/i })).toBeVisible({ timeout: 15000 })
    await expect(page.locator('[data-tutorial="dashboard-stats"]')).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('link', { name: /Recoltari/i }).first()).toBeVisible({ timeout: 15000 })

    await page.getByRole('link', { name: /Terenuri/i }).first().click()
    await expect(page).toHaveURL(/\/parcele/, { timeout: 15000 })
    await expect(page.getByText(TEST_TEREN_NAME)).toBeVisible({ timeout: 15000 })
  })
})
