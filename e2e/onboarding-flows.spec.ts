/**
 * Fluxuri: guest, demo, signup/start, utilizator fără/cu tenant, ieșire demo → /start.
 * Necesită: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (`.env.local`).
 */
import { test, expect, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

type TestUser = { id: string; email: string; password: string }

type OnboardingCtx = {
  service: SupabaseClient
  noTenantUser: TestUser
  withTenantUser: TestUser
}

const ctx: Partial<OnboardingCtx> = {}
let demoGuestUserId: string | null = null

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

function uniqueToken(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function decodeJwtSub(token: string): string | null {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as { sub?: string }
    return typeof payload.sub === 'string' ? payload.sub : null
  } catch {
    return null
  }
}

async function createConfirmedUser(service: SupabaseClient, label: string): Promise<TestUser> {
  const email = `${uniqueToken(label)}@example.test`
  const password = `Pwd!${Math.random().toString(36).slice(2, 10)}1A`
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error || !data.user) {
    throw new Error(`Failed creating ${label}: ${error?.message ?? 'unknown'}`)
  }
  return { id: data.user.id, email, password }
}

async function loginViaUi(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.locator('#login-email').fill(email)
  await page.locator('#login-password').fill(password)
  await page.getByRole('button', { name: 'Autentifica-te' }).click()
  await page.waitForURL(/\/(dashboard|parcele|start)/, { timeout: 45000 })
}

async function teardownUser(service: SupabaseClient, userId: string) {
  const { data: profile } = await service.from('profiles').select('tenant_id').eq('id', userId).maybeSingle()
  if (profile?.tenant_id) {
    await service.from('tenants').delete().eq('id', profile.tenant_id)
  }
  await service.auth.admin.deleteUser(userId)
}

async function teardownDemoGuest(service: SupabaseClient, userId: string) {
  try {
    const { data: profile } = await service.from('profiles').select('tenant_id').eq('id', userId).maybeSingle()
    if (profile?.tenant_id) {
      await service.from('tenants').delete().eq('id', profile.tenant_id)
    }
  } catch {
    // best-effort
  }
  try {
    await service.auth.admin.deleteUser(userId)
  } catch {
    // best-effort — FK-uri demo posibile
  }
}

test.describe('Onboarding, demo și guards', () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ viewport: { width: 1366, height: 900 } })

  test.beforeAll(async () => {
    const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
    const service = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    })

    // `handle_auth_user_created` leagă automat profilul de un tenant nou — nu putem schimba tenant_id prin upsert (trigger protect).
    const noTenantUser = await createConfirmedUser(service, 'e2e_onb_no_tenant')
    const { data: noTProfile } = await service.from('profiles').select('tenant_id').eq('id', noTenantUser.id).maybeSingle()
    if (noTProfile?.tenant_id) {
      const { error: delErr } = await service.from('tenants').delete().eq('id', noTProfile.tenant_id)
      if (delErr) {
        throw new Error(`tenant delete (no-tenant fixture): ${delErr.message}`)
      }
    }
    const { data: noTAfter } = await service.from('profiles').select('tenant_id').eq('id', noTenantUser.id).maybeSingle()
    if (noTAfter?.tenant_id != null) {
      throw new Error('Fixture fără tenant: tenant_id ar trebui să fie null după ștergerea tenantului.')
    }

    const withTenantUser = await createConfirmedUser(service, 'e2e_onb_with_tenant')
    const { data: withTProfile } = await service
      .from('profiles')
      .select('tenant_id')
      .eq('id', withTenantUser.id)
      .maybeSingle()
    if (!withTProfile?.tenant_id) {
      throw new Error('Fixture cu tenant: lipsește tenant_id după triggerul de onboarding.')
    }

    ctx.service = service
    ctx.noTenantUser = noTenantUser
    ctx.withTenantUser = withTenantUser
  })

  test.afterAll(async () => {
    const service = ctx.service
    if (!service) return
    const c = ctx as OnboardingCtx
    try {
      if (demoGuestUserId) await teardownDemoGuest(service, demoGuestUserId)
    } catch {
      // noop
    }
    try {
      if (c.noTenantUser?.id) await teardownUser(service, c.noTenantUser.id)
      if (c.withTenantUser?.id) await teardownUser(service, c.withTenantUser.id)
    } catch {
      // noop
    }
  })

  test('guest: acces /dashboard → redirect la login', async ({ page, context }) => {
    await context.clearCookies()
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/login/, { timeout: 30000 })
  })

  test('guest: /start afișează ecranul de intrare', async ({ page, context }) => {
    await context.clearCookies()
    await page.goto('/start', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Intră în aplicație' })).toBeVisible({ timeout: 30000 })
  })

  test('demo: UI demo, banner, setări și CTA Creează-ți ferma → /start (fără sesiune)', async ({ page, context }) => {
    test.setTimeout(180_000)
    await context.clearCookies()
    demoGuestUserId = null

    page.on('response', async (response) => {
      if (response.request().method() !== 'POST') return
      if (!response.url().includes('/api/auth/beta-guest')) return
      if (response.status() !== 200) return
      try {
        const body = (await response.json()) as { accessToken?: string }
        if (body?.accessToken) {
          const sub = decodeJwtSub(body.accessToken)
          if (sub) demoGuestUserId = sub
        }
      } catch {
        /* ignore */
      }
    })

    await page.goto('/start', { waitUntil: 'domcontentloaded' })
    const continueNoAccount = page.getByRole('button', { name: /Continuă fără cont/i })
    await expect(continueNoAccount).toBeEnabled({ timeout: 30_000 })
    await continueNoAccount.click()

    const berriesCard = page.getByRole('button', { name: /Fructe de pădure/i })
    await expect(berriesCard).toBeVisible({ timeout: 15000 })
    await berriesCard.click()

    await page.waitForURL(/\/dashboard/, { timeout: 120_000 })

    await expect(page.getByTestId('demo-banner-create-farm')).toBeVisible({ timeout: 30000 })

    await page.goto('/settings', { waitUntil: 'domcontentloaded', timeout: 60000 })
    const createFarmCta = page.getByTestId('settings-create-farm-cta')
    await expect(createFarmCta).toBeVisible({ timeout: 30000 })
    await expect(createFarmCta).toHaveCount(1)
    await createFarmCta.scrollIntoViewIfNeeded()
    await Promise.all([
      page.waitForURL(/\/start/, { timeout: 60_000 }),
      createFarmCta.click(),
    ])
    await expect(page.getByRole('heading', { name: 'Intră în aplicație' })).toBeVisible({ timeout: 30000 })

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Intră în aplicație' })).toBeVisible({ timeout: 30000 })

    await page.getByRole('link', { name: /Continuă cu email/i }).click()
    await expect(page).toHaveURL(/\/login.*mode=register/, { timeout: 15000 })

    expect(demoGuestUserId).toMatch(/^[0-9a-f-]{36}$/i)
  })

  test('utilizator fără tenant: /dashboard duce la /start', async ({ page, context }) => {
    test.setTimeout(90_000)
    const c = ctx as OnboardingCtx
    await context.clearCookies()
    await loginViaUi(page, c.noTenantUser.email, c.noTenantUser.password)
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 60000 })
    await expect(page).toHaveURL(/\/start/, { timeout: 45000 })
  })

  test('utilizator cu tenant: /start redirecționează spre dashboard', async ({ page, context }) => {
    test.setTimeout(90_000)
    const c = ctx as OnboardingCtx
    await context.clearCookies()
    await loginViaUi(page, c.withTenantUser.email, c.withTenantUser.password)
    await page.goto('/start', { waitUntil: 'domcontentloaded', timeout: 60000 })
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 45000 })
  })

  test('utilizator cu tenant real nu vede CTA-ul demo din setări', async ({ page, context }) => {
    test.setTimeout(90_000)
    const c = ctx as OnboardingCtx
    await context.clearCookies()
    await loginViaUi(page, c.withTenantUser.email, c.withTenantUser.password)
    await page.goto('/settings', { waitUntil: 'domcontentloaded', timeout: 60000 })
    await expect(page.getByTestId('settings-create-farm-cta')).toHaveCount(0)
  })

  test('logout din UI (tab bar): POST /api/auth/sign-out → /', async ({ page, context }) => {
    test.setTimeout(90_000)
    const c = ctx as OnboardingCtx
    await context.clearCookies()
    await loginViaUi(page, c.withTenantUser.email, c.withTenantUser.password)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/dashboard', { waitUntil: 'load', timeout: 60000 })
    await expect(page.getByRole('navigation', { name: 'Navigare principală' })).toBeVisible({ timeout: 30000 })
    const moreBtn = page.locator('nav[aria-label="Navigare principală"] button[aria-label="Mai mult"]')
    await expect(moreBtn).toBeVisible({ timeout: 15000 })
    await moreBtn.click()
    await expect(page.locator('form[action$="/api/auth/sign-out"]')).toBeVisible({ timeout: 25000 })
    const signOutBtn = page.locator('form[action$="/api/auth/sign-out"]').getByRole('button', { name: 'Deconectare' })
    await signOutBtn.scrollIntoViewIfNeeded()
    await expect(signOutBtn).toBeVisible({ timeout: 10000 })
    await Promise.all([page.waitForURL((u) => u.pathname === '/', { timeout: 30_000 }), signOutBtn.click()])
  })

  test('guest: /login se încarcă (fără redirect la /start)', async ({ page, context }) => {
    await context.clearCookies()
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/login/)
    await expect(page.locator('#login-email')).toBeVisible({ timeout: 15000 })
  })
})
