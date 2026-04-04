/**
 * Cap-coadă: demo guest → ieșire (banner) → /start → înregistrare beta (fără confirmare email în UI)
 * → dashboard real → fără CTA demo → refresh → logout/login → guards.
 *
 * Necesită: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (`.env.local`).
 */
import { test, expect } from '@playwright/test'
import { createClient as createSupabaseAnon } from '@supabase/supabase-js'

import {
  createServiceRoleClient,
  decodeJwtSub,
  deleteAuthUserBestEffort,
  deleteAuthUserByEmail,
  findAuthUserIdByEmail,
  requireEnv,
} from './helpers/supabase-admin-e2e'

let conversionEmail: string | null = null
let conversionPassword: string | null = null
let demoGuestUserId: string | null = null

function uniqueConversionEmail(): string {
  return `e2e_demo_real_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.test`
}

test.describe('Conversie demo → fermă reală', () => {
  test.use({ viewport: { width: 1366, height: 900 } })

  test.afterAll(async () => {
    const service = createServiceRoleClient()
    if (conversionEmail) {
      try {
        await deleteAuthUserByEmail(service, conversionEmail)
      } catch {
        /* noop */
      }
    }
    if (demoGuestUserId) {
      await deleteAuthUserBestEffort(service, demoGuestUserId)
    }
  })

  test('flux complet: demo → leave → register → tenant real → persistență sesiune și guards', async ({
    page,
    context,
  }) => {
    test.setTimeout(300_000)
    conversionEmail = uniqueConversionEmail()
    conversionPassword = `Pwd!${Math.random().toString(36).slice(2, 10)}1A`
    const farmLabel = `E2E Real ${Math.random().toString(36).slice(2, 6)}`
    demoGuestUserId = null

    await context.clearCookies()

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

    await test.step('Demo guest și banner', async () => {
      await page.goto('/start', { waitUntil: 'domcontentloaded' })
      await expect(page.getByRole('button', { name: /Continuă fără cont/i })).toBeEnabled({ timeout: 30_000 })
      await page.getByRole('button', { name: /Continuă fără cont/i }).click()
      await expect(page.getByRole('button', { name: /Fructe de pădure/i })).toBeVisible({ timeout: 15_000 })
      await page.getByRole('button', { name: /Fructe de pădure/i }).click()
      await page.waitForURL(/\/dashboard/, { timeout: 120_000 })
      await expect(page.getByTestId('demo-banner-create-farm')).toBeVisible({ timeout: 30_000 })
      expect(demoGuestUserId).toMatch(/^[0-9a-f-]{36}$/i)
    })

    await test.step('Ieșire demo (form banner) → /start fără sesiune', async () => {
      const bannerCta = page.getByTestId('demo-banner-create-farm')
      await Promise.all([page.waitForURL(/\/start/, { timeout: 60_000 }), bannerCta.click()])
      await expect(page.getByRole('heading', { name: 'Intră în aplicație' })).toBeVisible({ timeout: 30_000 })
    })

    await test.step('Înregistrare: /start → login mode=register', async () => {
      await page.getByRole('link', { name: /Continuă cu email/i }).click()
      await expect(page).toHaveURL(/\/login/, { timeout: 20_000 })
      await expect(page).toHaveURL(/mode=register/, { timeout: 15_000 })
    })

    await test.step('beta-signup + autentificare automată → /dashboard', async () => {
      await page.locator('#register-email').fill(conversionEmail!)
      await page.locator('#register-farm').fill(farmLabel)
      await page.locator('#register-password').fill(conversionPassword!)
      await page.locator('#register-password-confirm').fill(conversionPassword!)
      await Promise.all([
        page.waitForURL(/\/dashboard/, { timeout: 120_000 }),
        page.getByTestId('login-register-submit').click(),
      ])
    })

    await test.step('UI: fără mod demo', async () => {
      await expect(page.getByTestId('demo-banner-create-farm')).toHaveCount(0)
    })

    await test.step('DB: utilizator real, tenant, nu e fermă demo', async () => {
      const service = createServiceRoleClient()
      const uid = await findAuthUserIdByEmail(service, conversionEmail!)
      expect(uid).toBeTruthy()
      const { data: profile } = await service.from('profiles').select('tenant_id').eq('id', uid!).maybeSingle()
      expect(profile?.tenant_id, 'tenant după signup').toBeTruthy()
      const { data: tenant } = await service
        .from('tenants')
        .select('nume_ferma, is_demo')
        .eq('id', profile!.tenant_id!)
        .maybeSingle()
      expect(tenant?.nume_ferma).toBeTruthy()
      expect(tenant?.is_demo).toBe(false)
    })

    await test.step('Setări: email real vizibil, fără CTA demo', async () => {
      await page.goto('/settings', { waitUntil: 'domcontentloaded', timeout: 60_000 })
      await expect(page.getByTestId('settings-create-farm-cta')).toHaveCount(0)
      await expect(page.getByText(conversionEmail!)).toBeVisible({ timeout: 15_000 })
    })

    await test.step('Refresh pe dashboard: încă fără banner demo', async () => {
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 60_000 })
      await page.reload({ waitUntil: 'domcontentloaded' })
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 })
      await expect(page.getByTestId('demo-banner-create-farm')).toHaveCount(0)
    })

    await test.step('Logout → login: încă autentificat cu același tenant', async () => {
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
      const origin = new URL(page.url()).origin
      // POST din pagină (ca leave-demo) ca să aplice Set-Cookie în același Storage ca sesiunea UI.
      await page.evaluate((o) => {
        const f = document.createElement('form')
        f.method = 'POST'
        f.action = `${o}/api/auth/sign-out`
        document.body.appendChild(f)
        f.submit()
      }, origin)
      await page.waitForURL((u) => u.pathname === '/', { timeout: 45_000 })
      await context.clearCookies()
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
      await expect(page).toHaveURL(/\/login/, { timeout: 20_000 })
      await page.goto('/login', { waitUntil: 'domcontentloaded' })
      /* Verificare credențiale + pas de stabilizare: după beta-signup, primul sign-in în browser poate rămâne fără navigare fără mesaj clar în UI. */
      const preflight = createSupabaseAnon(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'), {
        auth: { persistSession: false, autoRefreshToken: false },
      })
      const { error: preErr } = await preflight.auth.signInWithPassword({
        email: conversionEmail!,
        password: conversionPassword!,
      })
      if (preErr) throw new Error(`Preflight signInWithPassword: ${preErr.message}`)

      // După înregistrare în același tab, Radix poate rămâne pe „Creeaza cont” — forțăm tab Login și formularul corect.
      await page.getByRole('tab', { name: 'Login' }).click()
      const loginForm = page.locator('form').filter({ has: page.locator('#login-email') })
      await loginForm.locator('#login-email').fill(conversionEmail!)
      await loginForm.locator('#login-password').fill(conversionPassword!)
      await Promise.all([
        page.waitForURL(/\/dashboard/, { timeout: 90_000 }),
        loginForm.getByRole('button', { name: 'Autentifica-te' }).click(),
      ])
      await expect(page.getByTestId('demo-banner-create-farm')).toHaveCount(0)
    })

    await test.step('Guards: /start → dashboard; /login → dashboard (fără loop)', async () => {
      await page.goto('/start', { waitUntil: 'domcontentloaded', timeout: 60_000 })
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 45_000 })
      await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 60_000 })
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 45_000 })
      const url = page.url()
      expect(url).not.toMatch(/\/start.*\/login|\/login.*\/start/)
    })
  })
})
