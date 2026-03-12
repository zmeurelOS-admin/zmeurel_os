import { expect, test, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

type DemoUser = {
  id: string
  email: string
  password: string
}

type DemoContext = {
  service: SupabaseClient
  user: DemoUser
  tenantId: string
}

const ctx: Partial<DemoContext> = {}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

function uniqueToken(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function getCtx(): DemoContext {
  if (!ctx.service || !ctx.user || !ctx.tenantId) {
    throw new Error('Demo test context is not initialized')
  }
  return ctx as DemoContext
}

async function createDemoTestUser(service: SupabaseClient): Promise<DemoUser> {
  const email = `${uniqueToken('demo_flow')}@example.test`
  const password = `Pwd!${Math.random().toString(36).slice(2, 10)}1A`

  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error || !data.user) {
    throw new Error(`Failed creating demo test user: ${error?.message ?? 'unknown error'}`)
  }

  return { id: data.user.id, email, password }
}

async function loginViaUi(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login')
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.getByRole('button', { name: /intra|login/i }).click()
}

async function openDemoOnboarding(page: Page): Promise<void> {
  await page.goto('/')
  await page.goto('/start')
  await expect(page.getByText(/Testează Zmeurel OS în modul demo/i)).toBeVisible({ timeout: 15000 })
}

async function assertDashboardLoaded(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20000 })
  await expect(page.getByRole('heading', { name: /Dashboard/i })).toBeVisible({ timeout: 15000 })
  await expect(page.locator('[data-tutorial="dashboard-stats"]')).toBeVisible({ timeout: 15000 })
  await expect(page.getByRole('link', { name: /Dashboard/i }).first()).toBeVisible({ timeout: 15000 })
  await expect(page.getByRole('link', { name: /Terenuri/i }).first()).toBeVisible({ timeout: 15000 })

  const recordsSection = page.locator('section').filter({ hasText: /Recoltare azi pe terenuri/i }).first()
  await expect(recordsSection).toBeVisible({ timeout: 15000 })
  await expect(recordsSection.locator('button').nth(1)).toBeVisible({ timeout: 15000 })
}

test.describe('Demo onboarding flow', () => {
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

    const user = await createDemoTestUser(service)

    const { data: tenant, error: tenantError } = await service
      .from('tenants')
      .insert({
        nume_ferma: uniqueToken('demo_flow_ferma'),
        owner_user_id: user.id,
        plan: 'pro',
      })
      .select('id')
      .single()

    if (tenantError || !tenant?.id) {
      throw new Error(`Failed creating demo test tenant: ${tenantError?.message ?? 'unknown error'}`)
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

  test('homepage -> start demo -> seed -> dashboard', async ({ page }) => {
    const c = getCtx()
    await loginViaUi(page, c.user.email, c.user.password)
    await openDemoOnboarding(page)

    const seedResponsePromise = page.waitForResponse((response) => {
      const request = response.request()
      return request.method() === 'POST' && response.url().includes('/api/demo/seed')
    })

    await page.getByRole('button', { name: /Pornește demo/i }).first().click()

    const seedResponse = await seedResponsePromise
    expect(seedResponse.status()).toBe(200)
    await assertDashboardLoaded(page)
  })

  test('mobile viewport renders dashboard after demo seed', async ({ page }) => {
    const c = getCtx()
    await page.setViewportSize({ width: 375, height: 812 })
    await loginViaUi(page, c.user.email, c.user.password)
    await page.goto('/dashboard')
    await assertDashboardLoaded(page)
  })
})
