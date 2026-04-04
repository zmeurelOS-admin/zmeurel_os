/**
 * Acces Admin: compară fermier obișnuit vs superadmin.
 *
 * Setup superadmin:
 * 1) Ideal: `profiles.is_superadmin` poate fi setat prin service role (vezi migrarea `prevent_privileged_profile_changes`).
 * 2) Altfel: cont manual cu superadmin în Supabase + `E2E_SUPERADMIN_EMAIL` / `E2E_SUPERADMIN_PASSWORD` în `.env.local`.
 *
 * Necesită: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (ca celelalte e2e).
 */
import { test, expect, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

type TestUser = {
  id: string
  email: string
  password: string
}

type AdminAccessCtx = {
  url: string
  service: SupabaseClient
  regularUser: TestUser
  /** Prezent doar dacă promovarea `is_superadmin` a reușit sau dacă ai setat env (vezi comentariu `beforeAll`). */
  superUser?: TestUser
  /** Dacă true, `afterAll` șterge și userul superadmin creat de test; dacă false (cont din env), nu îl ștergem. */
  superUserManaged: boolean
}

const ctx: Partial<AdminAccessCtx> = {}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

function uniqueToken(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
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
    throw new Error(`Failed creating ${label}: ${error?.message ?? 'unknown error'}`)
  }

  return {
    id: data.user.id,
    email,
    password,
  }
}

async function loginViaUi(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.locator('#login-email').fill(email)
  await page.locator('#login-password').fill(password)
  await page.getByRole('button', { name: 'Autentifica-te' }).click()
  await page.waitForURL(/\/(dashboard|parcele|start)/, { timeout: 30000 })
}

async function teardownUser(service: SupabaseClient, userId: string) {
  const { data: profile } = await service.from('profiles').select('tenant_id').eq('id', userId).maybeSingle()

  if (profile?.tenant_id) {
    await service.from('tenants').delete().eq('id', profile.tenant_id)
  }
  await service.auth.admin.deleteUser(userId)
}

test.describe('Admin access', () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ viewport: { width: 1366, height: 900 } })

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

    const regularUser = await createConfirmedUser(service, 'admin_e2e_regular')
    const superCandidate = await createConfirmedUser(service, 'admin_e2e_super')

    let superUser: TestUser | undefined
    let superUserManaged = false

    const { error: promoteError } = await service
      .from('profiles')
      .update({ is_superadmin: true })
      .eq('id', superCandidate.id)

    if (!promoteError) {
      superUser = superCandidate
      superUserManaged = true
    } else {
      await teardownUser(service, superCandidate.id)
      const e2eEmail = process.env.E2E_SUPERADMIN_EMAIL?.trim()
      const e2ePassword = process.env.E2E_SUPERADMIN_PASSWORD?.trim()
      if (e2eEmail && e2ePassword) {
        superUser = { id: '', email: e2eEmail, password: e2ePassword }
        superUserManaged = false
      }
    }

    ctx.url = url
    ctx.service = service
    ctx.regularUser = regularUser
    ctx.superUser = superUser
    ctx.superUserManaged = superUserManaged
  })

  test.afterAll(async () => {
    const service = ctx.service
    if (!service) return
    const c = ctx as AdminAccessCtx
    try {
      if (c.regularUser?.id) await teardownUser(service, c.regularUser.id)
      if (c.superUserManaged && c.superUser?.id) await teardownUser(service, c.superUser.id)
    } catch {
      // best-effort teardown
    }
  })

  test('regular user cannot see or access admin area', async ({ page, context }) => {
    test.setTimeout(120_000)
    const c = ctx as AdminAccessCtx
    await context.clearCookies()
    await loginViaUi(page, c.regularUser.email, c.regularUser.password)

    const desktopNav = page.getByRole('navigation', { name: 'Navigare desktop' })
    await expect(desktopNav.getByRole('button', { name: 'Administrare' })).toHaveCount(0)
    await expect(desktopNav.getByRole('link', { name: 'Panou admin' })).toHaveCount(0)
    await expect(desktopNav.getByRole('link', { name: 'Analytics' })).toHaveCount(0)
    await expect(desktopNav.getByRole('link', { name: 'Audit' })).toHaveCount(0)

    for (const path of ['/admin', '/admin/analytics', '/admin/audit']) {
      await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 90_000 })
      await expect(page).toHaveURL(/\/dashboard\/?$/, { timeout: 30_000 })
    }

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/dashboard')
    await page.getByRole('button', { name: 'Mai mult' }).click()
    await expect(page.getByText('Admin (Zmeurel)')).toHaveCount(0)
  })

  test('superadmin sees and can access admin area', async ({ page, context }) => {
    const c = ctx as AdminAccessCtx
    test.skip(
      !c.superUser?.email,
      'Lipsește superadmin de test: fie DB-ul permite promovarea automată, fie setează E2E_SUPERADMIN_EMAIL + E2E_SUPERADMIN_PASSWORD (.env.local).'
    )
    const superAccount = c.superUser!

    test.setTimeout(120_000)
    await context.clearCookies()
    await loginViaUi(page, superAccount.email, superAccount.password)

    const desktopNav = page.getByRole('navigation', { name: 'Navigare desktop' })
    await expect(desktopNav.getByRole('button', { name: 'Administrare' })).toBeVisible()

    const panouLink = desktopNav.getByRole('link', { name: 'Panou admin' })
    const analyticsLink = desktopNav.getByRole('link', { name: 'Analytics' })
    const auditLink = desktopNav.getByRole('link', { name: 'Audit' })

    await expect(panouLink).toBeVisible()
    await expect(analyticsLink).toBeVisible()
    await expect(auditLink).toBeVisible()

    await panouLink.click()
    await expect(page).toHaveURL(/\/admin\/?$/)
    await expect(panouLink).toHaveAttribute('aria-current', 'page')

    await analyticsLink.click()
    await expect(page).toHaveURL(/\/admin\/analytics/)
    await expect(analyticsLink).toHaveAttribute('aria-current', 'page')
    await expect(page.getByRole('heading', { name: 'Analytics produs' })).toBeVisible({ timeout: 60000 })

    await auditLink.click()
    await expect(page).toHaveURL(/\/admin\/audit/)
    await expect(auditLink).toHaveAttribute('aria-current', 'page')
    await expect(page.getByRole('heading', { name: 'Audit Planuri' })).toBeVisible()

    await page.goto('/admin')
    await expect(page).toHaveURL(/\/admin\/?$/)
    await page.goto('/admin/analytics')
    await expect(page).toHaveURL(/\/admin\/analytics/)
    await page.goto('/admin/audit')
    await expect(page).toHaveURL(/\/admin\/audit/)

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/dashboard')
    await page.getByRole('button', { name: 'Mai mult' }).click()
    await expect(page.getByText('Admin (Zmeurel)')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Panou admin' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Analytics global' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Audit' })).toBeVisible()
  })
})
